import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { getAuthUserId } from "@/lib/auth-server";

// POST /api/p2p/confirm — المستلم يؤكّد الاستلام
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("p2p-conf:" + clientId, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = await getAuthUserId(req);
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

  // ─── تحقق من عدم انتهاء الصلاحية ───
  if (txn.expires_at && new Date(txn.expires_at).getTime() < Date.now()) {
    await admin.from("p2p_transactions")
      .update({ status: "expired" })
      .eq("id", transaction_id)
      .eq("status", "verifying");
    return NextResponse.json({ error: "انتهت صلاحية المعاملة" }, { status: 400 });
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
  // 1. atomic lock: حاول تحديث الحالة لـ "settled" (لو status = verifying)
  // يمنع race condition: لو طلبان متزامنان، واحد ينجح، الثاني يفشل قبل الـ side effects
  const { data: locked } = await admin.from("p2p_transactions")
    .update({ status: "settled" })
    .eq("id", transaction_id)
    .eq("status", "verifying")
    .select("id");

  if (!locked || locked.length === 0) {
    // الـ update ما أثر على أي صف — معاملة تم تأكيدها بالفعل أو ليست في حالة verifying
    return NextResponse.json({ error: "تعذّر تأكيد المعاملة — قد تكون مكتملة" }, { status: 409 });
  }

  // 2. الآن بأمان نفّذ الـ side effects (مرة وحدة فقط لأن الحالة قفلت)
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

  // 3. سوّ الدين تلقائياً لو مربوط بدين
  if (txn.debt_request_id) {
    await admin.rpc("settle_debt_from_p2p", {
      p_debt_id: txn.debt_request_id,
      p_settle_amount: txn.amount,
      p_from_user: txn.from_user,
      p_to_user: txn.to_user,
      p_friendship_id: txn.friendship_id,
    });
  }

  // 4. أنشئ السند
  await admin.rpc("create_p2p_sanad", {
    p_transaction_id: transaction_id,
    p_message_id: sanadMessageId,
  });

  // 5. حدّث sanad_message_id (الحالة قفلت بالفعل في الخطوة 1)
  if (sanadMessageId) {
    await admin.from("p2p_transactions")
      .update({ sanad_message_id: sanadMessageId })
      .eq("id", transaction_id);
  }

  return NextResponse.json({
    ok: true,
    status: "settled",
    sanad_message_id: sanadMessageId,
    message: "تم إنشاء السند وتسوية الدين تلقائياً ✅",
  });
}
