import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import * as crypto from "crypto";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  const { phone, pin } = await req.json();
  if (!phone || !pin) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles").select("*").eq("phone", phone).maybeSingle();

  if (!profile) return NextResponse.json({ error: "الرقم غير مسجل" }, { status: 404 });

  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `تم قفل الحساب. حاول بعد ${mins} دقيقة` }, { status: 423 });
  }

  if (!profile.email_verified) {
    return NextResponse.json({ error: "لم يتم تأكيد الإيميل بعد" }, { status: 403 });
  }

  const pinHash = crypto.scryptSync(pin, profile.email, 64).toString("hex");

  if (pinHash !== profile.pin_hash) {
    const attempts = (profile.failed_attempts || 0) + 1;
    const updates: any = { failed_attempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      updates.failed_attempts = 0;
      await admin.from("profiles").update(updates).eq("phone", phone);
      return NextResponse.json({ error: `محاولات خاطئة كثيرة. تم قفل الحساب ${LOCK_MINUTES} دقيقة` }, { status: 423 });
    }
    await admin.from("profiles").update(updates).eq("phone", phone);
    return NextResponse.json({ error: `رمز خاطئ. محاولات متبقية: ${MAX_ATTEMPTS - attempts}` }, { status: 401 });
  }

  await admin.from("profiles").update({ failed_attempts: 0, locked_until: null }).eq("phone", phone);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { redirectTo: `${req.nextUrl.origin}/auth/callback` },
  });

  if (linkErr || !linkData) {
    return NextResponse.json({ error: "تعذر إنشاء جلسة" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, redirect: linkData.properties.action_link });
}
