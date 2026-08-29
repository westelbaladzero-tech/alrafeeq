import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  const { phone, pin, accessToken } = await req.json();
  if (!phone || !pin || pin.length < 4) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
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

  // أنشئ الملف
  const { error } = await admin.from("profiles").insert({
    id: user.id, email: user.email, phone,
    pin_hash: pinHash, email_verified: true,
    failed_attempts: 0, locked_until: null,
  });

  if (error) return NextResponse.json({ error: "تعذر حفظ البيانات" }, { status: 500 });
  return NextResponse.json({ ok: true, message: "تم ربط البيانات" });
}
