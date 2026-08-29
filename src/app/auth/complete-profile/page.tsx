"use client";
import { useState, useEffect } from "react";
import { Phone, Lock, Check, Wallet } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function CompleteProfilePage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function check() {
      const sb = getSupabase();
      if (!sb) { setChecking(false); return; }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = "/auth/login"; return; }
      setEmail(user.email || "");
      // تحقق إذا الملف موجود
      const { data: profile } = await sb.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (profile) { window.location.href = "/"; return; }
      setChecking(false);
    }
    check();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!phone) { setErr("أدخل رقم الهاتف"); return; }
    if (pin.length < 4) { setErr("الرمز يجب أن يكون 4 خانات على الأقل"); return; }
    if (pin !== confirmPin) { setErr("الرمزان غير متطابقين"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.error) { setErr(data.error); return; }
      setDone(true);
      setTimeout(() => { window.location.href = "/"; }, 1500);
    } catch {
      setLoading(false);
      setErr("تعذّر الاتصال");
    }
  }

  if (checking) return <div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>;

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold">تم إنشاء حسابك!</h2>
          <p className="text-gray-500 mt-2">جاري تحويلك للتطبيق...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">أكمل بياناتك</h1>
          <p className="text-sm text-gray-500">مرحباً {email}</p>
          <p className="text-xs text-gray-400 mt-1">اربط رقم هاتفك ورمز الحماية</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
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
          <button type="submit" disabled={loading}
            className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-50">
            <Check size={18} /> {loading ? "جاري الربط..." : "ربط البيانات"}
          </button>
        </form>
      </div>
    </main>
  );
}
