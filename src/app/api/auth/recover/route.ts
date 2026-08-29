import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-server';
import { getSupabase } from '@/lib/supabase';

// استعادة الرمز: إيميل → ماجيك لينك → صفحة رمز جديد
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'الإيميل مطلوب' }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'خطأ إعداد' }, { status: 500 });

  // التحقق من وجود الحساب
  const { data: profile } = await admin
    .from('profiles').select('phone').eq('email', email).maybeSingle();

  if (!profile) {
    // لأمان: لا نخبر المستخدم أن الإيميل غير موجود
    return NextResponse.json({ ok: true, message: 'إذا كان الإيميل مسجلاً، سيصلك رابط' });
  }

  // إرسال ماجيك لينك
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${req.nextUrl.origin}/auth/reset-pin` },
    });
  }

  return NextResponse.json({ ok: true, message: 'تم إرسال رابط الاستعادة إلى إيميلك' });
}
