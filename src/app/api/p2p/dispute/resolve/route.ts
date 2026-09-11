import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { logFinancialEvent } from "@/lib/audit-log";
import { getAuthUserId } from "@/lib/auth-server";

// POST /api/p2p/dispute/resolve — الطرف الآخر يحل النزاع
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("p2p-res:" + clientId, 3, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { transaction_id, resolution } = await req.json();

  if (!transaction_id || !["accept", "reject"].includes(resolution)) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // اجلب المعاملة
  const { data: txn } = await admin.from("p2p_transactions")
    .select("id, from_user, to_user, status, dispute_deadline, dispute_opened_by")
    .eq("id", transaction_id).single();

  if (!txn) {
    return NextResponse.json({ error: "معاملة غير موجودة" }, { status: 404 });
  }

  // تحقق أن المستخدم طرف في المعاملة
  if (txn.from_user !== userId && txn.to_user !== userId) {
    return NextResponse.json({ error: "لست طرفاً في هذه المعاملة" }, { status: 403 });
  }

  // تحقق أن المعاملة منازعة
  if (txn.status !== "disputed") {
    return NextResponse.json({ error: "المعاملة ليست محل نزاع" }, { status: 400 });
  }

  // تحقق من إن المستخدم هو الطرف الآخر (مو اللي فتح النزاع)
  // يمنع التلاعب: المرسل ما يقدر يفتح نزاع ثم يحله بـ accept (refunded) لنفسه
  if (txn.dispute_opened_by && txn.dispute_opened_by === userId) {
    return NextResponse.json({ error: "لا يمكنك حل نزاعك الخاص — الطرف الآخر فقط يحل النزاع" }, { status: 403 });
  }

  // تحقق من مهلة الحل
  if (txn.dispute_deadline && new Date(txn.dispute_deadline) < new Date()) {
    // انتهت المهلة ← قفل تلقائي كـ settled
    await admin.from("p2p_transactions").update({
      status: "settled",
      dispute_resolution_note: "انتهت مهلة الحل — قفل تلقائي",
    }).eq("id", transaction_id);
    return NextResponse.json({ error: "انتهت مهلة حل النزاع" }, { status: 400 });
  }

  // الحل: accept = استرجاع (refunded)، reject = تأكيد (settled)
  const newStatus = resolution === "accept" ? "refunded" : "settled";
  const otherParty = txn.from_user === userId ? txn.to_user : txn.from_user;

  await admin.from("p2p_transactions").update({
    status: newStatus,
    dispute_resolved_by: userId,
    dispute_resolution_note: resolution,
  }).eq("id", transaction_id);

  // سجل الحدث المالي
  await logFinancialEvent({
    eventType: "dispute_resolved",
    actorId: userId,
    targetUserId: otherParty,
    entityType: "p2p_transaction",
    entityId: transaction_id,
    metadata: { resolution, newStatus },
    req: req as unknown as Request,
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
