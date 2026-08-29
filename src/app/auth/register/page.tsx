"use client";
import { useState } from "react";
import { Mail, Send, Wallet } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!email) { setErr("أدخل الإيميل"); return; }
    setLoading(true);

    const sb = getSupabase();
    if (!sb) { setLoading(false); setErr("خطأ إعداد"); return; }

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/complete-profile` },
    });

    setLoading(false);

    if (error) {
      setErr(error.message.includes("rate") ? "تم تجاوز حد الإرسال. انتظر دقائق" : error.message);
      return;
    }
    setSent(true);
    setMsg("تم إرسال رابط التأكيد إلى إيميلك. افتح الرسالة واضغط الرابط لإكمال التسجيل.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">حساب جديد</h1>
          <p className="text-sm text-gray-500">أدخل إيميلك لبدء التسجيل</p>
        </div>
        {sent ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 rounded-2xl p-5 text-green-700 text-sm">{msg}</div>
            <a href="/auth/login" className="text-[var(--accent)] font-bold block">العودة لتسجيل الدخول</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Mail size={18} className="absolute right-3 top-3.5 text-gray-300" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required
                className="w-full bg-gray-50 rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
            </div>
            {err && <div className="text-red-500 text-sm text-center">{err}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-50">
              <Send size={18} /> {loading ? "جاري الإرسال..." : "إرسال رابط التأكيد"}
            </button>
          </form>
        )}
        <a href="/auth/login" className="w-full text-center text-sm text-gray-500 mt-4 block">
          لديك حساب؟ <span className="text-[var(--accent)] font-bold">سجل دخول</span>
        </a>
      </div>
    </main>
  );
}
