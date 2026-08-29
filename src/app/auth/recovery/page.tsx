'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Wallet } from 'lucide-react';

export default function RecoveryPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');

    const res = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.message) setMsg(data.message);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">استعادة الرمز</h1>
          <p className="text-sm text-gray-500">أدخل إيميلك لاستلام رابط الاستعادة</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Mail size={18} className="absolute right-3 top-3.5 text-gray-300" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="الإيميل" required
              className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          </div>

          {msg && <div className="text-green-600 text-sm text-center bg-green-50 rounded-xl p-3">{msg}</div>}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-50">
            <Send size={18} /> {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
          </button>
        </form>

        <button onClick={() => router.push('/auth/login')} className="w-full text-center text-sm text-gray-500 mt-4">
          رجوع لتسجيل الدخول
        </button>
      </div>
    </main>
  );
}
