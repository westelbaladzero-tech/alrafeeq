'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Check, Wallet } from 'lucide-react';

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // تأكيد الجلسة من ماجيك لينك
    const code = params.get('code');
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (code && sbUrl && anon) {
      import('@supabase/supabase-js').then(({ createClient }) => {
        const sb = createClient(sbUrl, anon);
        sb.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) router.replace('/auth/login');
          else setReady(true);
        });
      });
    } else { router.replace('/auth/login'); }
  }, [params, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    if (pin !== confirmPin) { setErr('الرمزان غير متطابقين'); return; }
    if (pin.length < 4) { setErr('الرمز يجب أن يكون 4 خانات على الأقل'); return; }

    setLoading(true);
    const res = await fetch('/api/auth/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) { setErr(data.error); return; }
    setMsg('تم تحديث الرمز بنجاح');
    setTimeout(() => router.push('/auth/login'), 1500);
  }

  if (!ready) return <div className="flex items-center justify-center h-screen text-gray-400">جاري التأكيد...</div>;

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">رمز جديد</h1>
          <p className="text-sm text-gray-500">عيّن رمز حماية جديد لحسابك</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Lock size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="الرمز الجديد" maxLength={8} required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="تأكيد الرمز" required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>

          {err && <div className="text-red-500 text-sm text-center">{err}</div>}
          {msg && <div className="text-green-600 text-sm text-center bg-green-50 rounded-xl p-3">{msg}</div>}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-50">
            <Check size={18} /> {loading ? 'جاري الحفظ...' : 'حفظ الرمز'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPinPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>}>
    <ResetInner />
  </Suspense>;
}
