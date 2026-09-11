import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { trackUsage } from "@/lib/usage";
import { validatePin } from "@/lib/validation";
import * as crypto from "crypto";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const FIXED_DELAY_MS = 80;
const UNIFORM_ERROR = "رقم الهاتف أو الرمز غير صحيح";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const { phone, pin } = await req.json().catch(() => ({}));

  if (!phone || !pin) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  if (!validatePin(pin)) {
    return NextResponse.json({ error: UNIFORM_ERROR }, { status: 401 });
  }

  // ─── طبقة 1: Rate limiting على مستوى IP (5/دقيقة) — strict ───
  const clientId = getClientId(req as unknown as Request);
  const rlIp = await rateLimitDB("login:ip:" + clientId, 5, 60, true);
  if (!rlIp.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  // ─── طبقة 2: Rate limiting على مستوى الهاتف (5/دقيقة) — strict ───
  const rlPhone = await rateLimitDB("login:phone:" + phone, 5, 60, true);
  if (!rlPhone.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles").select("*").eq("phone", phone).maybeSingle();

  // ─── رد موحّد دائماً — بدون كشف وجود الرقم ───
  if (!profile) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < FIXED_DELAY_MS) await sleep(FIXED_DELAY_MS - elapsed);
    return NextResponse.json({ error: UNIFORM_ERROR }, { status: 401 });
  }

  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `تم قفل الحساب. حاول بعد ${mins} دقيقة` }, { status: 423 });
  }

  if (!profile.email_verified) {
    return NextResponse.json({ error: "لم يتم تأكيد الإيميل بعد" }, { status: 403 });
  }

  const pinHash = crypto.scryptSync(pin, profile.email, 64).toString("hex");

  // ─── مقارنة بزمن ثابت لمنع timing attacks ───
  const inputBuf = Buffer.from(pinHash, "hex");
  const storedBuf = Buffer.from(profile.pin_hash, "hex");
  const pinMatch = inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);

  if (!pinMatch) {
    const attempts = (profile.failed_attempts || 0) + 1;
    const updates: any = { failed_attempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      updates.failed_attempts = 0;
      await admin.from("profiles").update(updates).eq("phone", phone);
      const elapsed = Date.now() - startedAt;
      if (elapsed < FIXED_DELAY_MS) await sleep(FIXED_DELAY_MS - elapsed);
      return NextResponse.json({ error: `محاولات خاطئة كثيرة. تم قفل الحساب ${LOCK_MINUTES} دقيقة` }, { status: 423 });
    }
    await admin.from("profiles").update(updates).eq("phone", phone);
    const elapsed = Date.now() - startedAt;
    if (elapsed < FIXED_DELAY_MS) await sleep(FIXED_DELAY_MS - elapsed);
    return NextResponse.json({ error: UNIFORM_ERROR }, { status: 401 });
  }

  // ─── نجح ← أصفّر العدّاد ───
  await admin.from("profiles").update({ failed_attempts: 0, locked_until: null }).eq("phone", phone);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { redirectTo: `${req.nextUrl.origin}/auth/callback` },
  });

  if (linkErr || !linkData) {
    return NextResponse.json({ error: "تعذر إنشاء جلسة" }, { status: 500 });
  }

  await trackUsage("magic_link", "login", true, profile.id);
  return NextResponse.json({ ok: true, redirect: linkData.properties.action_link });
}
