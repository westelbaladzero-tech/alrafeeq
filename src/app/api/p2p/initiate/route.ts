import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { validateAmount } from "@/lib/validation";
import { getUserIdSync } from "@/lib/client-id";

// POST /api/p2p/initiate — بدء معاملة P2P
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("p2p-init:" + clientId, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const userId = getUserIdSync();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { to_user, friendship_id, amount, method, debt_request_id } = await req.json();

  if (!to_user || !amount || !method) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  if (to_user === userId) {
    return NextResponse.json({ error: "لا يمكن الإرسال لنفسك" }, { status: 400 });
  }

  const amt = validateAmount(amount);
  if (!amt.ok) {
    return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });
  }

  if (!["vodafone_cash", "instapay", "other"].includes(method)) {
    return NextResponse.json({ error: "وسيلة دفع غير مدعومة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // لو مرتبط بدين ← علّق الدين
  let debtSuspended = false;
  if (debt_request_id) {
    const { error: rpcErr } = await admin.rpc("suspend_debt_for_p2p", {
      p_debt_id: debt_request_id,
      p_amount: amt.value,
    });
    if (!rpcErr) debtSuspended = true;
  }

  // أنشئ المعاملة
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة
  const { data, error } = await admin.from("p2p_transactions").insert({
    from_user: userId,
    to_user,
    friendship_id: friendship_id || null,
    amount: amt.value,
    method,
    status: "awaiting_details",
    debt_request_id: debt_request_id || null,
    expires_at: expiresAt.toISOString(),
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: "تعذّر بدء المعاملة" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: data?.id,
    status: "awaiting_details",
    debt_suspended: debtSuspended,
    expires_at: expiresAt.toISOString(),
  });
}
