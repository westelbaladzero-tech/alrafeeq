import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";

// POST /api/p2p/confirm — المستلم يؤكّد الاستلام
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("p2p-conf:" + clientId, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = req.headers.get("x-client-id");
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { transaction_id, confirmed } = await req.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق أن المستخدم هو المستلم
  const { data: txn } = await admin.from("p2p_transactions")
    .select("*")
    .eq("id", transaction_id)
    .single();

  if (!txn) {
    return NextResponse.json({ error: "معاملة غير موجودة" }, { status: 404 });
  }

  if (txn.to_user !== userId) {
    return NextResponse.json({ error: "فقط المستلم يؤكّد الاستلام" }, { status: 403 });
  }

  if (txn.status !== "verifying") {
    return NextResponse.json({ error: "المعاملة ليست قيد التحقق" }, { status: 400 });
  }

  if (!confirmed) {
    // المستلم رفض ← دخول التحكيم
    const { error } = await admin.from("p2p_transactions")
      .update({
        status: "disputed",
        dispute_reason: "المستلم لم يؤكّد الاستلام",
      })
      .eq("id", transaction_id);

    if (error) {
      return NextResponse.json({ error: "تعذّر تحديث الحالة" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: "disputed",
      message: "تم دخول التحكيم — سيتم المراجعة",
    });
  }

  // المستلم أكّد ← اكتملت المعاملة
  // 1. أنشئ رسالة السند في جدول messages
  let sanadMessageId = null;
  if (txn.friendship_id) {
    const { data: msg } = await admin.from("messages").insert({
      friendship_id: txn.friendship_id,
      sender_id: "system",
      text: `📄 سند دفع موثّق\nالمبلغ: ${txn.amount} جنيه\nمن: ${txn.from_user}\nإلى: ${txn.to_user}\nوسيلة: ${txn.method}\nالحالة: موثّق ✅`,
      type: "sanad",
      p2p_transaction_id: transaction_id,
    }).select("id").single();
    sanadMessageId = msg?.id || null;
  }

  // 2. سوّ الدين تلقائياً لو مربوط بدين
  if (txn.debt_request_id) {
    await admin.rpc("settle_debt_from_p2p", {
      p_debt_id: txn.debt_request_id,
      p_settle_amount: txn.amount,
      p_from_user: txn.from_user,
      p_to_user: txn.to_user,
      p_friendship_id: txn.friendship_id,
    });
  }

  // 3. أنشئ السند + حدّث الحالة
  await admin.rpc("create_p2p_sanad", {
    p_transaction_id: transaction_id,
    p_message_id: sanadMessageId,
  });

  // 4. لو لم تُستدعَ الدالة (لا يوجد sanad_message_id) ← حدّث يدوياً
  await admin.from("p2p_transactions")
    .update({ status: "settled", sanad_message_id: sanadMessageId })
    .eq("id", transaction_id)
    .eq("status", "verifying");

  return NextResponse.json({
    ok: true,
    status: "settled",
    sanad_message_id: sanadMessageId,
    message: "تم إنشاء السند وتسوية الدين تلقائياً ✅",
  });
}
