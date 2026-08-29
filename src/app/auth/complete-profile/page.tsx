"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Phone, Lock, Check, Wallet } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

function CompleteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("waiting"); // waiting → form → done
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [authErr, setAuthErr] = useState("");
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    async function init() {
      const sb = getSupabase();
      if (!sb) { router.replace("/auth/login"); return; }

      // انتظر قليلاً ليكتشف المتصفّح الجلسة من الرابط تلقائياً
      await new Promise(r => setTimeout(r, 500));

      const { data: { user } } = await sb.auth.getUser();
      if (!user) { 
        setAuthErr("لم يتم تأكيد الإيميل. تأكد من فتح الرابط من نفس المتصفّح");
        setStatus("error"); 
        return; 
      }
      setEmail(user.email || "");

      // تحقق: الملف موجود؟
      const { data: profile } = await sb
        .from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (profile) { router.replace("/"); return; }

      setStatus("form");
    }
    init();
  }, [router]);

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
      setStatus("done");
      setTimeout(() => { window.location.href = "/"; }, 1500);
    } catch {
      setLoading(false);
      setErr("تعذّر الاتصال");
    }
  }

  if (status === "waiting")
    return <div className="flex items-center justify-center h-screen text-gray-400">جاري تأكيد الإيميل...</div>;

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <div className="text-center max-w-sm">
          <div className="text-red-500 text-lg font-bold mb-2">خطأ</div>
          <p className="text-gray-500 mb-4">{authErr}</p>
          <a href="/auth/register" className="text-[var(--accent)] font-bold">حاول مرة أخرى</a>
        </div>
      </main>
    );
  }

  if (status === "done") {
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

export default function CompleteProfilePage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>}>
    <CompleteInner />
  </Suspense>;
}
