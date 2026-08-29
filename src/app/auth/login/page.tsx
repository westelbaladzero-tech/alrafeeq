'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, LogIn, Wallet } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) { setErr(data.error); return; }

    // توجيه إلى ماجيك لينك لتأسيس الجلسة
    if (data.redirect) {
      window.location.href = data.redirect;
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">الرفيق</h1>
          <p className="text-sm text-gray-500">أهلاً بعودتك</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Phone size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الهاتف" required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="رمز الحماية" maxLength={8} required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>

          {err && <div className="text-red-500 text-sm text-center">{err}</div>}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-50">
            <LogIn size={18} /> {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="flex justify-between mt-4 text-sm">
          <button onClick={() => router.push('/auth/recovery')} className="text-gray-500">نسيت الرمز؟</button>
          <button onClick={() => router.push('/auth/register')} className="text-[var(--accent)] font-bold">حساب جديد</button>
        </div>
      </div>
    </main>
  );
}
