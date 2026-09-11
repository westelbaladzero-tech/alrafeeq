import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { validatePin } from "@/lib/validation";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  // ─── Rate limiting (5/دقيقة لكل IP) ───
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("complete-profile:ip:" + clientId, 5, 60, true);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const { phone, pin, accessToken } = await req.json().catch(() => ({}));
  if (!phone || !pin) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  if (!validatePin(pin)) {
    return NextResponse.json({ error: "الرمز يجب أن يكون 4 خانات على الأقل" }, { status: 400 });
  }

  // تحقق من الجلسة باستخدام access token المرسل من العميل
  const sb = getServerClient();
  if (!sb) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  if (!accessToken) {
    return NextResponse.json({ error: "لم يتم تأكيد الإيميل" }, { status: 401 });
  }

  const { data: { user } } = await sb.auth.getUser(accessToken);
  if (!user || !user.email) {
    return NextResponse.json({ error: "لم يتم تأكيد الإيميل" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق: الرقم غير مستخدم
  const { data: existingPhone } = await admin
    .from("profiles").select("email").eq("phone", phone).maybeSingle();
  if (existingPhone) {
    return NextResponse.json({ error: "رقم الهاتف مرتبط بإيميل آخر" }, { status: 409 });
  }

  // تشفير الرمز
  const pinHash = crypto.scryptSync(pin, user.email, 64).toString("hex");

  // معرف العميل — فريد لكل مستخدم
  const profileClientId = crypto.randomUUID();

  // أنشئ الملف (مع client_id)
  const { error } = await admin.from("profiles").insert({
    id: user.id, email: user.email, phone,
    pin_hash: pinHash, email_verified: true,
    failed_attempts: 0, locked_until: null,
    client_id: profileClientId,
  });

  // لو فشل بسبب عدم وجود عمود client_id → أعد المحاولة بدونه
  if (error && error.message?.includes("client_id")) {
    const { error: err2 } = await admin.from("profiles").insert({
      id: user.id, email: user.email, phone,
      pin_hash: pinHash, email_verified: true,
      failed_attempts: 0, locked_until: null,
    });
    if (err2) return NextResponse.json({ error: "تعذر حفظ البيانات" }, { status: 500 });
    return NextResponse.json({ ok: true, message: "تم ربط البيانات" });
  }

  if (error) return NextResponse.json({ error: "تعذر حفظ البيانات" }, { status: 500 });
  return NextResponse.json({ ok: true, message: "تم ربط البيانات", clientId: profileClientId });
}
