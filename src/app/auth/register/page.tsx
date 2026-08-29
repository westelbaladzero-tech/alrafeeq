'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Lock, UserPlus, Wallet } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');

    if (pin !== confirmPin) { setErr('الرمزان غير متطابقين'); return; }
    if (pin.length < 4) { setErr('الرمز يجب أن يكون 4 خانات على الأقل'); return; }

    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, pin }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) setErr(data.error);
    else setMsg(data.message + '. افتح إيميلك واضغط على الرابط لتأكيد التسجيل.');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">الرفيق</h1>
          <p className="text-sm text-gray-500">أنشئ حسابك الجديد</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Mail size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="الإيميل" required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>
          <div className="relative">
            <Phone size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الهاتف" required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="رمز الحماية (4 خانات)" maxLength={8} required
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
            <UserPlus size={18} /> {loading ? 'جاري الإرسال...' : 'تسجيل جديد'}
          </button>
        </form>

        <button onClick={() => router.push('/auth/login')} className="w-full text-center text-sm text-gray-500 mt-4">
          لديك حساب؟ <span className="text-[var(--accent)] font-bold">سجل دخول</span>
        </button>
      </div>
    </main>
  );
}
