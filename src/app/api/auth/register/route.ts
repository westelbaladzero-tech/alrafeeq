import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// تسجيل جديد: إيميل فقط → ماجيك لينك
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "الإيميل مطلوب" }, { status: 400 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${req.nextUrl.origin}/auth/callback` },
  });

  if (error) return NextResponse.json({ error: "تعذر إرسال رابط التأكيد" }, { status: 500 });
  return NextResponse.json({ ok: true, message: "تم إرسال رابط التأكيد" });
}
