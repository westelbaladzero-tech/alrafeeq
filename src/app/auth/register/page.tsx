"use client";
import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import AuthShell from "@/components/AuthShell";
import AuthInput from "@/components/AuthInput";

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
    <AuthShell
      eyebrow="بداية هادئة وآمنة"
      title="ابدأ بالإيميل، ونكمل الباقي معًا."
      description="هنبعت لك رابط تأكيد على بريدك، وبعدها تربط رقم الهاتف والرمز السري في خطوة واحدة بسيطة."
    >
      <div className="mb-4">
        <div className="text-[var(--accent)] text-sm font-semibold">خطوة أولى</div>
        <h2 className="text-xl font-bold text-[#16342d]">تسجيل جديد</h2>
      </div>

      {sent ? (
        <div className="text-center space-y-4">
          <div className="bg-green-50 rounded-2xl p-5 text-green-700 text-sm leading-7">{msg}</div>
          <a href="/auth/login" className="text-[var(--accent)] font-bold block">العودة لتسجيل الدخول</a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-[#36534c] mb-2 block">البريد الإلكتروني</label>
            <AuthInput icon={<Mail size={18} />} type="email" placeholder="name@example.com" value={email} onChange={setEmail} required />
          </div>
          {err && <div className="text-red-500 text-sm text-center">{err}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 flex items-center justify-center gap-2 font-bold disabled:opacity-50 shadow-sm">
            <Send size={18} /> {loading ? "جاري الإرسال..." : "إرسال رابط التأكيد"}
          </button>
        </form>
      )}

      <a href="/auth/login" className="w-full text-center text-sm text-gray-500 mt-4 block">
        لديك حساب؟ <span className="text-[var(--accent)] font-bold">سجل دخول</span>
      </a>
    </AuthShell>
  );
}
