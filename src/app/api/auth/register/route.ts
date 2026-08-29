import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// تسجيل جديد: إيميل فقط → ماجيك لينك
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "الإيميل مطلوب" }, { status: 400 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "خطأ إعداد — المفاتيح غير متوفرة" }, { status: 500 });

  const redirectUrl = `${req.nextUrl.origin}/auth/callback`;
  console.log("Register attempt:", email, "redirect:", redirectUrl);

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl },
  });

  if (error) {
    console.error("Supabase OTP error:", error.message, error.code);
    return NextResponse.json({ error: `خطأ: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "تم إرسال رابط التأكيد" });
}
