"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Lock, Mail, User, Shield, ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, pin }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) { setErr(data.error); return; }
    if (data.redirect) window.location.href = data.redirect;
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
            <p className="text-sm text-[var(--accent)] mb-1">انضم لرفيقك</p>
            <h1 className="text-2xl font-bold text-[var(--accent-dark)]">حساب جديد</h1>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-lg)] border border-[var(--soft)]">
          <form onSubmit={submit} className="space-y-3">
            <Field icon={<User size={18} />} label="الاسم">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="اسمك الكريم" required
                className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
            </Field>
            <Field icon={<Phone size={18} />} label="رقم الهاتف">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx" required
                className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
            </Field>
            <Field icon={<Mail size={18} />} label="البريد الإلكتروني">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com" required
                className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
            </Field>
            <Field icon={<Lock size={18} />} label="رمز الحماية">
              <input type="password" value={pin} onChange={e => setPin(e.target.value)}
                placeholder="••••" maxLength={8} required
                className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
            </Field>

            {err && <div className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">{err}</div>}

            <button type="submit" disabled={loading}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 font-bold disabled:opacity-50 text-sm">
              {loading ? "جاري الإنشاء..." : "أنشئ الحساب"}
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

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[var(--muted)] mb-1 block">{label}</label>
      <div className="relative">
        <div className="absolute right-3 top-3.5 text-[var(--accent)]">{icon}</div>
        {children}
      </div>
    </div>
  );
}
