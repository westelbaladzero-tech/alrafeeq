import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-server';

// إكمال الملف الشخصي بعد تأكيد الماجيك لينك
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'الإيميل مطلوب' }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'خطأ إعداد' }, { status: 500 });

  // جلب التسجيل المعلق
  const { data: pending } = await admin
    .from('pending_registrations').select('*').eq('email', email).maybeSingle();

  if (!pending) {
    // قد يكون تسجيل دخول عادي أو استعادة — نتأكد من وجود الملف
    const { data: existing } = await admin
      .from('profiles').select('email').eq('email', email).maybeSingle();
    if (existing) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: 'لا يوجد تسجيل معلق' }, { status: 404 });
  }

  // إنشاء الملف الشخصي
  const { error } = await admin.from('profiles').insert({
    email: pending.email,
    phone: pending.phone,
    pin_hash: pending.pin_hash,
    email_verified: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // حذف من المعلق
  await admin.from('pending_registrations').delete().eq('email', email);

  return NextResponse.json({ ok: true });
}
