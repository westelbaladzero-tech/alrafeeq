import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { getAuthUserId } from "@/lib/auth-server";

// GET /api/p2p — قائمة معاملاتي
export async function GET(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("p2p-list:" + clientId, 20, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  let query = admin.from("p2p_transactions")
    .select("*")
    .or(`from_user.eq.${userId},to_user.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "تعذّر جلب المعاملات" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transactions: data || [] });
}

// POST /api/p2p — إلغاء معاملة
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("p2p-cancel:" + clientId, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { transaction_id } = await req.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق أن المستخدم طرف
  const { data: txn } = await admin.from("p2p_transactions")
    .select("id, from_user, to_user, status, debt_request_id")
    .eq("id", transaction_id)
    .single();

  if (!txn) {
    return NextResponse.json({ error: "معاملة غير موجودة" }, { status: 404 });
  }

  if (txn.from_user !== userId && txn.to_user !== userId) {
    return NextResponse.json({ error: "لست طرفاً في هذه المعاملة" }, { status: 403 });
  }

  if (["settled", "cancelled"].includes(txn.status)) {
    return NextResponse.json({ error: "المعاملة مكتملة أو ملغاة" }, { status: 400 });
  }

  // ألغِ المعاملة
  const { error } = await admin.from("p2p_transactions")
    .update({ status: "cancelled" })
    .eq("id", transaction_id);

  if (error) {
    return NextResponse.json({ error: "تعذّر الإلغاء" }, { status: 500 });
  }

  // لو كان الدين معلّقاً ← أعد لحالته
  if (txn.debt_request_id) {
    await admin.from("debt_requests")
      .update({ status: "confirmed" })
      .eq("id", txn.debt_request_id)
      .eq("status", "p2p_pending");
  }

  return NextResponse.json({
    ok: true,
    status: "cancelled",
    message: "تم إلغاء المعاملة",
  });
}
