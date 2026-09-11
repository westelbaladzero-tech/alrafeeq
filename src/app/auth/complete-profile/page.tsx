"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Phone, Lock, Check, Shield } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import AuthShell from "@/components/AuthShell";
import AuthInput from "@/components/AuthInput";

function CompleteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("waiting");
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
      await new Promise(r => setTimeout(r, 500));
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setAuthErr("لم يتم تأكيد الإيميل. افتح الرابط من الرسالة مرة ثانية");
        setStatus("error");
        return;
      }
      setEmail(user.email || "");
      const { data: profile } = await sb.from("profiles").select("id").eq("id", user.id).maybeSingle();
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
      const sb = getSupabase();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { setErr("انتهت الجلسة. أعد التسجيل"); setLoading(false); return; }
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin, accessToken: session.access_token }),
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

  if (status === "waiting") return <div className="flex items-center justify-center h-screen text-gray-400">جاري تأكيد الإيميل...</div>;
  if (status === "error") {
    return (
      <AuthShell eyebrow="تعذّر التأكيد" title="الرابط محتاج محاولة جديدة." description={authErr}>
        <a href="/auth/register" className="text-[var(--accent)] font-bold block text-center">حاول مرة أخرى</a>
      </AuthShell>
    );
  }
  if (status === "done") {
    return (
      <AuthShell eyebrow="تم بنجاح" title="حسابك بقى جاهز." description="ثواني قليلة ونحوّلك للرفيق.">
        <div className="text-center text-green-700 font-semibold">تم إنشاء حسابك بنجاح ✨</div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="تأكيد وربط" title="خلّينا نربط بياناتك مرة واحدة." description={`مرحباً ${email} — ضيف رقم الهاتف والرمز السري عشان يبقى دخولك سهل بعد كده.`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[var(--accent)] text-sm font-semibold">الخطوة الثانية</div>
          <h2 className="text-xl font-bold text-[#16342d]">أكمل بياناتك</h2>
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
        <div>
          <label className="text-sm font-semibold text-[#36534c] mb-2 block">تأكيد الرمز</label>
          <AuthInput icon={<Lock size={18} />} type="password" placeholder="••••" value={confirmPin} onChange={setConfirmPin} highlighted required maxLength={8} />
        </div>
        {err && <div className="text-red-500 text-sm text-center">{err}</div>}
        <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 flex items-center justify-center gap-2 font-bold disabled:opacity-50 shadow-sm">
          <Check size={18} /> {loading ? "جاري الربط..." : "ربط البيانات"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function CompleteProfilePage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>}><CompleteInner /></Suspense>;
}
