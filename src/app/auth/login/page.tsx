"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Lock, LogIn, Shield } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import AuthInput from "@/components/AuthInput";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setErr(data.error); return; }
    if (data.redirect) window.location.href = data.redirect;
  }

  return (
    <AuthShell
      eyebrow="مساحتك المالية الهادئة"
      title="ادخل، واحكِ ما حدث لمالك."
      description="الدخول بسيط وآمن برقم الهاتف والرمز السري. ولو نسيت الرمز، نرجّعه لك من بريدك في هدوء."
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[var(--accent)] text-sm font-semibold">مرحبًا بعودتك</div>
          <h2 className="text-xl font-bold text-[#16342d]">دخول الرفيق</h2>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shadow-sm">
          <Shield size={20} />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-sm font-semibold text-[#36534c] mb-2 block">رقم الهاتف</label>
          <AuthInput icon={<Phone size={18} />} type="tel" placeholder="01050909821" value={phone} onChange={setPhone} required />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#36534c] mb-2 block">الرمز السري</label>
          <AuthInput icon={<Lock size={18} />} type="password" placeholder="••••" value={pin} onChange={setPin} highlighted required maxLength={8} />
        </div>

        {err && <div className="text-red-500 text-sm text-center">{err}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 flex items-center justify-center gap-2 font-bold disabled:opacity-50 shadow-sm">
          <LogIn size={18} /> {loading ? "جاري الدخول..." : "دخول الرفيق"}
        </button>
      </form>

      <div className="flex justify-between mt-4 text-sm">
        <button onClick={() => router.push("/auth/recovery")} className="text-gray-500">نسيت الرمز؟</button>
        <button onClick={() => router.push("/auth/register")} className="text-[var(--accent)] font-bold">حساب جديد</button>
      </div>
    </AuthShell>
  );
}
