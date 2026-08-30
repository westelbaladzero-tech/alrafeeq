"use client";
import { useRouter } from "next/navigation";
import { Shield, MessageCircle, Users, Receipt, Sparkles } from "lucide-react";

export default function Splash() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* دائرة زخرفية */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[var(--soft)] opacity-60" />
      <div className="absolute top-40 -left-32 w-64 h-64 rounded-full bg-[var(--soft-pink)] opacity-50" />

      <div className="relative w-full max-w-sm">
        {/* الشعار */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--soft)] flex items-center justify-center">
            <Shield size={24} className="text-[var(--accent)]" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-[var(--accent-dark)]">الرفيق الأمين</h1>
            <p className="text-xs text-[var(--muted)]">رفيقك في كل مالك</p>
          </div>
        </div>

        {/* العنوان */}
        <div className="text-center mb-8">
          <p className="text-sm text-[var(--accent)] mb-2">مساحتك المالية الهادئة</p>
          <h2 className="text-3xl font-bold text-[var(--accent-dark)] leading-tight mb-3">
            ادخل، واحكِ<br />ما حدث لمالك.
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            اكتب مصروفاتك ودخلك بالعربية بكل بساطة، والرفيق يفهم ويسجّل وينصحك
          </p>
        </div>

        {/* المميزات */}
        <div className="space-y-2 mb-8">
          <Feature icon={<MessageCircle size={18} />} title="محاور ذكي" desc="يفهم العامية ويسجّل لك أوتوماتيك" />
          <Feature icon={<Receipt size={18} />} title="سجل منظّم" desc="مصروفاتك بالفئات والمجاميع" />
          <Feature icon={<Users size={18} />} title="حسابات الأشخاص" desc="تتبّع ديونك ومستحقاتك" />
        </div>

        {/* الأزرار */}
        <button onClick={() => router.push("/auth/login")}
          className="w-full rounded-2xl bg-[var(--accent)] text-white py-3.5 font-bold mb-3 shadow-sm">
          ابدأ الآن
        </button>
        <button onClick={() => router.push("/auth/register")}
          className="w-full rounded-2xl bg-[var(--soft)] text-[var(--accent-dark)] py-3.5 font-bold">
          أنشئ حساب جديد
        </button>
      </div>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/70 rounded-2xl p-3 border border-[var(--soft)]">
      <div className="w-9 h-9 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0 text-[var(--accent)]">
        {icon}
      </div>
      <div className="text-right">
        <div className="font-bold text-sm text-[var(--text)]">{title}</div>
        <div className="text-xs text-[var(--muted)]">{desc}</div>
      </div>
    </div>
  );
}
