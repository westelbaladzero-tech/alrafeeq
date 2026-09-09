import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { rateLimit, getClientId } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/validation";

// استرداد الحساب — إرسال Magic Link للإيميل
export async function POST(req: NextRequest) {
  // ─── Rate limiting: 3 محاولات/دقيقة لكل IP ───
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("recover:" + clientId, 3, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );
  }

  const cleanEmail = sanitizeText(email.toLowerCase().trim(), 200);

  // ─── Rate limiting لكل إيميل: حد واحد بالساعة (يمنع إغراق بريد شخص) ───
  const emailRl = rateLimit("recover-email:" + cleanEmail, 1, 60 * 60 * 1000);
  if (!emailRl.allowed) {
    return NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );
  }

  const { data: profile } = await admin
    .from("profiles").select("phone").eq("email", cleanEmail).maybeSingle();

  // ─── نفس الرد دائماً (منع user enumeration) ───
  const genericResponse = () =>
    NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );

  if (!profile) {
    return genericResponse();
  }

  const sb = getServerClient();
  if (sb) {
    try {
      await sb.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: `${req.nextUrl.origin}/auth/reset-pin` },
      });
    } catch {
      // تجاهل — نفس الرد لمنع تسريب المعلومات
    }
  }

  // ─── نفس الرد حتى لو نجح ───
  return genericResponse();
}
