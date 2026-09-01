import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { trackUsage } from "@/lib/usage";

// تسجيل جديد: إيميل فقط → ماجيك لينك
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "الإيميل مطلوب" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "خطأ إعداد — المفاتيح غير متوفرة" }, { status: 500 });
  }

  // عميل خادم بدون persistSession (يشتغل على server)
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const redirectUrl = `${req.nextUrl.origin}/auth/callback`;

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl },
  });

  if (error) {
    console.error("Supabase OTP error:", error.message, error.code);
    return NextResponse.json({ error: `خطأ: ${error.message}` }, { status: 500 });
  }

  await trackUsage("magic_link", "register", !error);
  return NextResponse.json({ ok: true, message: "تم إرسال رابط التأكيد" });
}
