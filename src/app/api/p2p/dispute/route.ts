import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { getUserIdSync } from "@/lib/client-id";
import { sanitizeText } from "@/lib/validation";
import { logFinancialEvent } from "@/lib/audit-log";

// POST /api/p2p/dispute — فتح خلاف
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("p2p-disp:" + clientId, 3, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = getUserIdSync();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { transaction_id, reason } = await req.json();

  if (!transaction_id || !reason) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق أن المستخدم طرف في المعاملة
  const { data: txn } = await admin.from("p2p_transactions")
    .select("id, from_user, to_user, status")
    .eq("id", transaction_id)
    .single();

  if (!txn) {
    return NextResponse.json({ error: "معاملة غير موجودة" }, { status: 404 });
  }

  if (txn.from_user !== userId && txn.to_user !== userId) {
    return NextResponse.json({ error: "لست طرفاً في هذه المعاملة" }, { status: 403 });
  }

  if (txn.status === "settled" || txn.status === "cancelled") {
    return NextResponse.json({ error: "المعاملة مكتملة أو ملغاة" }, { status: 400 });
  }

  // 48h deadline check
  const { data: fullTxn } = await admin.from("p2p_transactions")
    .select("settled_at").eq("id", transaction_id).single();
  if (fullTxn?.settled_at) {
    const hrs = (Date.now() - new Date(fullTxn.settled_at).getTime()) / 3600000;
    if (hrs > 48) {
      return NextResponse.json({ error: "انتهت مهلة فتح نزاع (48 ساعة)" }, { status: 400 });
    }
  }

  const { error } = await admin.from("p2p_transactions")
    .update({
      status: "disputed",
      dispute_reason: sanitizeText(reason, 500),
      dispute_deadline: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
    })
    .eq("id", transaction_id);

  if (error) {
    return NextResponse.json({ error: "تعذّر فتح الخلاف" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "disputed",
    message: "تم فتح الخلاف — سيتم التحكيم",
  });
}
