"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send, Shield, ArrowLeft } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function RecoveryPage() {
  const router = useRouter();
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
      options: { emailRedirectTo: window.location.origin + "/auth/reset-pin" },
    });
    setLoading(false);
    if (error) {
      setErr(error.message.includes("rate") ? "تم تجاوز حد الإرسال" : error.message);
      return;
    }
    setSent(true);
    setMsg("تم إرسال رابط الاستعادة إلى إيميلك. افتح الرسالة واضغط الرابط.");
  }

  return (
    <main className="min-h-screen flex flex-col p-6 relative overflow-hidden">
      <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-[var(--soft)] opacity-60" />
      <div className="relative w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        <button onClick={() => router.push("/auth/login")} className="flex items-center gap-1 text-[var(--muted)] text-sm mb-8 self-start">
          <ArrowLeft size={16} /> الدخول
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[var(--accent)] mb-1">نرجعها بهدوء</p>
            <h1 className="text-2xl font-bold text-[var(--accent-dark)]">استعادة الرمز</h1>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-lg)] border border-[var(--soft)]">
          <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">اكتب إيميلك، وهيوصلك رابط هادئ يوديك مباشرة لصفحة تعيين رمز جديد.</p>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 rounded-2xl p-5 text-green-700 text-sm leading-relaxed">{msg}</div>
              <a href="/auth/login" className="text-[var(--accent)] font-bold block">العودة للدخول</a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail size={18} className="absolute right-3 top-3.5 text-[var(--accent)]" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required dir="ltr" lang="en" inputMode="email" className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm text-left" />
                </div>
              </div>
              {err && <div className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">{err}</div>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 font-bold disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                <Send size={18} /> {loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
