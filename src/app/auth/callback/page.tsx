'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getAdminClient } from '@/lib/supabase-server';

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = params.get('code');
    const sb = getSupabase();
    if (!sb || !code) { router.replace('/auth/login'); return; }

    sb.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.user) { router.replace('/auth/login'); return; }

      // إنشاء الملف الشخصي من جدول التسجيلات المعلقة
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.user.email }),
      });

      if (res.ok) router.replace('/');
      else router.replace('/auth/login');
    });
  }, [params, router]);

  return <div className="flex items-center justify-center h-screen text-gray-400">جاري التأكيد...</div>;
}

export default function CallbackPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>}>
    <CallbackInner />
  </Suspense>;
}
