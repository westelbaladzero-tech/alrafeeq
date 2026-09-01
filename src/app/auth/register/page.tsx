"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Shield, ArrowLeft, Check } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) { setErr(data.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">رابط التحقق في طريقك</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            أرسلنا رابط تأكيد إلى <span className="font-bold text-[var(--accent)]">{email}</span>.
            افتح الرابط من نفس المتصفح لإكمال بياناتك.
          </p>
          <button onClick={() => router.push("/auth/login")}
            className="mt-6 text-[var(--accent)] font-bold text-sm">
            العودة لتسجيل الدخول
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6 relative overflow-hidden">
      <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-[var(--soft)] opacity-60" />

      <div className="relative w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        <button onClick={() => router.push("/")}
          className="flex items-center gap-1 text-[var(--muted)] text-sm mb-6 self-start">
          <ArrowLeft size={16} /> الرئيسية
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[var(--accent)] mb-1">انضم للرفيق الأمين</p>
            <h1 className="text-2xl font-bold text-[var(--accent-dark)]">حساب جديد</h1>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-lg)] border border-[var(--soft)]">
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            أدخل بريدك الإلكتروني، وسنرسل لك رابط تأكيد لإكمال بياناتك.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-3.5 text-[var(--accent)]" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com" required
                  className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
              </div>
            </div>

            {err && <div className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">{err}</div>}

            <button type="submit" disabled={loading}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 font-bold disabled:opacity-50 text-sm">
              {loading ? "جاري الإرسال..." : "أرسل رابط التحقق"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--muted)] mt-4">
          بتسجيلك توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </main>
  );
}
