"use client";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";

export default function Splash() {
  const router = useRouter();

  return (
    <AuthShell
      eyebrow="مساحتك المالية الهادئة"
      title="ادخل، واحكِ ما حدث لمالك."
      description="سجّل مصروفاتك ودخلك بالعربية ببساطة، وخلي الرفيق يفهمك ويعرض لك الصورة بهدوء ووضوح."
    >
      <div className="space-y-3">
        <button onClick={() => router.push('/auth/login')} className="w-full rounded-2xl bg-[var(--accent)] text-white py-4 font-bold text-lg shadow-sm">
          ابدأ الآن
        </button>
        <button onClick={() => router.push('/auth/register')} className="w-full rounded-2xl bg-[#f2efe7] text-[#52655f] py-4 font-bold">
          أنشئ حساب جديد
        </button>
      </div>
    </AuthShell>
  );
}
