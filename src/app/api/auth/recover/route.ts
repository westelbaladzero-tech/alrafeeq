import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/validation";

// استرداد الحساب — إرسال Magic Link للإيميل
export async function POST(req: NextRequest) {
  // ─── قراءة الإيميل أولاً ───
  const { email } = await req.json().catch(() => ({}));

  // ─── طبقة 1: Rate limiting على مستوى IP (3/دقيقة) ───
  const clientId = getClientId(req as unknown as Request);
  const rlIp = await rateLimitDB("recover:ip:" + clientId, 3, 60, true);
  if (!rlIp.allowed) {
    return NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );
  }

  // ─── طبقة 2: Rate limiting على مستوى الإيميل (3/دقيقة) ───
  // يحمي من spam حساب معيّن عبر IP rotation
  if (email) {
    const rlEmail = await rateLimitDB("recover:email:" + email, 3, 60, true);
    if (!rlEmail.allowed) {
      return NextResponse.json(
        { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
        { status: 200 }
      );
    }
  }

  if (!email) {
    return NextResponse.json(
      { ok: true, message: "إذا كان الإيميل مسجلاً، سيصلك رابط" },
      { status: 200 }
    );
  }

  const cleanEmail = sanitizeText(email.toLowerCase().trim(), 200);

  // ─── Rate limiting لكل إيميل: حد واحد بالساعة (يمنع إغراق بريد شخص) ───
  const emailRl = await rateLimitDB("recover-email:" + cleanEmail, 1, 3600);
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
