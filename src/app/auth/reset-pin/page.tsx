"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, Check, Shield, ArrowLeft } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("waiting");
  const [err, setErr] = useState("");
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    async function init() {
      const sb = getSupabase();
      if (!sb) { router.replace("/auth/login"); return; }
      await new Promise(r => setTimeout(r, 500));
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace("/auth/login"); return; }
      setStatus("form");
    }
    init();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pin.length < 4) { setErr("الرمز يجب أن يكون 4 خانات على الأقل"); return; }
    if (pin !== confirmPin) { setErr("الرمزان غير متطابقين"); return; }
    setLoading(true);
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { setErr("انتهت الجلسة"); setLoading(false); return; }
      const res = await fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, accessToken: session.access_token }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.error) { setErr(data.error); return; }
      setStatus("done");
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch {
      setLoading(false);
      setErr("تعذر الاتصال");
    }
  }

  if (status === "waiting")
    return <div className="flex items-center justify-center h-screen text-[var(--muted)]">جاري التأكيد...</div>;

  if (status === "done") {
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--accent-dark)]">تم تحديث الرمز!</h2>
          <p className="text-[var(--muted)] mt-2 text-sm">جاري تحويلك لتسجيل الدخول...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[var(--soft)] opacity-60" />
      <div className="relative w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        <button onClick={() => router.push("/auth/login")} className="flex items-center gap-1 text-[var(--muted)] text-sm mb-8 self-start">
          <ArrowLeft size={16} /> الدخول
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[var(--accent)] mb-1">خطوة أخيرة</p>
            <h1 className="text-2xl font-bold text-[var(--accent-dark)]">رمز جديد</h1>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-lg)] border border-[var(--soft)]">
          <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">عيّن رمز حماية جديد لحسابك. تأكد من كتابته مرتين صح.</p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">الرمز الجديد</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-3.5 text-[var(--accent)]" />
                <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" maxLength={8} required className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">تأكيد الرمز</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-3.5 text-[var(--accent)]" />
                <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="••••" required className="w-full bg-[var(--bg-warm)] rounded-2xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm" />
              </div>
            </div>
            {err && <div className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">{err}</div>}
            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 font-bold disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              <Check size={18} /> {loading ? "جاري الحفظ..." : "حفظ الرمز"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ResetPinPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-[var(--muted)]">جاري التحميل...</div>}>
    <ResetInner />
  </Suspense>;
}
