import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { trackUsage } from "@/lib/usage";

// تسجيل جديد: إيميل فقط → ماجيك لينك
export async function POST(req: NextRequest) {
  // ─── Rate limiting (3/دقيقة لكل IP) ───
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("register:ip:" + clientId, 3, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: "الإيميل مطلوب" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "خطأ إعداد — المفاتيح غير متوفرة" }, { status: 500 });
  }

  // ─── Rate limiting لكل إيميل (1/10 دقائق) ───
  const rlEmail = await rateLimitDB("register:email:" + email, 1, 600);
  if (!rlEmail.allowed) {
    return NextResponse.json({ error: "تم إرسال رابط التأكيد. تحقق من بريدك" }, { status: 429 });
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const redirectUrl = `${req.nextUrl.origin}/auth/callback`;

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl },
  });

  if (error) {
    return NextResponse.json({ error: "تعذر إرسال رابط التأكيد" }, { status: 500 });
  }

  await trackUsage("magic_link", "register", !error);
  return NextResponse.json({ ok: true, message: "تم إرسال رابط التأكيد" });
}
