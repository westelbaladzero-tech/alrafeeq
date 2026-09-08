import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { rateLimit, getClientId } from "@/lib/rate-limit";
import { validatePin } from "@/lib/validation";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  // ─── Rate limiting: 5 محاولات/دقيقة ───
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("pin:" + clientId, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — انتظر دقيقة" },
      { status: 429 }
    );
  }

  const { pin, accessToken, userId } = await req.json();
  if (!pin) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }
  // ─── تحقق من صيغة PIN ───
  if (!validatePin(pin)) {
    return NextResponse.json({ error: "رمز غير صحيح" }, { status: 400 });
  }
  if (!accessToken && !userId) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  let userSalt: string | null = null;
  let userUuid: string | null = null;

  // الطريقة 1: لو فيه accessToken، استخدمه
  if (accessToken) {
    try {
      const sb = getServerClient();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser(accessToken);
        if (user && user.email) {
          userSalt = user.email;
          userUuid = user.id;
        }
      }
    } catch {}
  }

  // الطريقة 2: fallback على userId
  if (!userSalt && userId) {
    userUuid = userId;
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.email) {
      userSalt = profile.email;
    }
  }

  if (!userSalt || !userUuid) {
    return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("id", userUuid)
    .maybeSingle();

  if (!profile || !profile.pin_hash) {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }

  // ─── تحقق من قفل الحساب ───
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `الحساب مقفل — حاول بعد ${mins} دقيقة` }, { status: 423 });
  }

  const pinHash = crypto.scryptSync(pin, userSalt, 64).toString("hex");

  // ─── مقارنة بزمن ثابت لمنع timing attacks ───
  const inputBuf = Buffer.from(pinHash, "hex");
  const storedBuf = Buffer.from(profile.pin_hash, "hex");
  const pinMatch = inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);
  if (!pinMatch) {
    // ─── زيادة عدّاد المحاولات الفاشلة ───
    const attempts = (profile.failed_attempts || 0) + 1;
    const MAX_ATTEMPTS = 5;
    const updates: any = { failed_attempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + 15 * 60000).toISOString();
      updates.failed_attempts = 0;
      await admin.from("profiles").update(updates).eq("id", userUuid);
      return NextResponse.json({ error: "محاولات كثيرة — قُفل الحساب 15 دقيقة" }, { status: 423 });
    }
    await admin.from("profiles").update(updates).eq("id", userUuid);
    return NextResponse.json({ error: `رمز خاطئ — متبقي ${MAX_ATTEMPTS - attempts} محاولات` }, { status: 401 });
  }

  // ─── نجح ← أصفّر العدّاد ───
  await admin.from("profiles").update({ failed_attempts: 0, locked_until: null }).eq("id", userUuid);

  return NextResponse.json({ ok: true });
}
