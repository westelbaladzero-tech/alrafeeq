import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-server';
import { getSupabase } from '@/lib/supabase';
import * as crypto from 'crypto';

// تسجيل جديد: إيميل + رقم هاتف + رمز
export async function POST(req: NextRequest) {
  const { email, phone, pin } = await req.json();

  if (!email || !phone || !pin || pin.length < 4) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'خطأ إعداد' }, { status: 500 });

  // التحقق: الرقم غير مستخدم
  const { data: existingPhone } = await admin
    .from('profiles').select('email').eq('phone', phone).maybeSingle();
  if (existingPhone) {
    return NextResponse.json({ error: 'رقم الهاتف مرتبط بإيميل آخر' }, { status: 409 });
  }

  // التحقق: الإيميل غير مستخدم
  const { data: existingEmail } = await admin
    .from('profiles').select('phone').eq('email', email).maybeSingle();
  if (existingEmail) {
    return NextResponse.json({ error: 'الإيميل مسجل مسبقاً' }, { status: 409 });
  }

  // تشفير الرمز
  const pinHash = crypto.scryptSync(pin, email, 64).toString('hex');

  // تخزين في جدول التسجيلات المعلقة
  await admin.from('pending_registrations').upsert({
    email, phone, pin_hash: pinHash,
  }, { onConflict: 'email' });

  // إرسال ماجيك لينك عبر العميل (anon key)
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${req.nextUrl.origin}/auth/callback` },
    });
    if (error) {
      return NextResponse.json({ error: 'تعذر إرسال رابط التأكيد' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, message: 'تم إرسال رابط التأكيد إلى إيميلك' });
}
