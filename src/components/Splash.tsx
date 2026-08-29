'use client';
import { useRouter } from 'next/navigation';
import { Wallet, MessageCircle, BarChart3, Shield } from 'lucide-react';

export default function Splash() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-24 h-24 rounded-3xl bg-[var(--soft)] flex items-center justify-center mx-auto mb-6">
          <Wallet size={44} className="text-[var(--accent)]" />
        </div>

        <h1 className="text-4xl font-bold mb-2">الرفيق</h1>
        <p className="text-gray-500 text-lg mb-2">الصديق الأمين لإدارة أموالك</p>
        <p className="text-gray-400 text-sm mb-10">
          سجّل مصروفاتك ودخلك بالعربية بكل بساطة، واحصل على ملخصات وإحصائيات تساعدك تتحكّم في ميزانيتك
        </p>

        <div className="space-y-3 mb-10">
          <Feature icon={<MessageCircle size={20} />} title="شات ذكي" desc="اكتب مصروفك بالعربية وهو يفهمه" />
          <Feature icon={<BarChart3 size={20} />} title="ملخصات فورية" desc="رصيدك وأعلى فئاتك في لمح البصر" />
          <Feature icon={<Shield size={20} />} title="حماية كاملة" desc="رمز حماية ومزامنة سحابية آمنة" />
        </div>

        <button onClick={() => router.push('/auth/login')}
          className="w-full rounded-2xl bg-[var(--accent)] text-white py-4 font-bold text-lg mb-3">
          ابدأ الآن
        </button>
        <button onClick={() => router.push('/auth/register')}
          className="w-full rounded-2xl bg-gray-100 text-gray-600 py-4 font-bold">
          أنشئ حساب جديد
        </button>
      </div>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100">
      <div className="w-10 h-10 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0 text-[var(--accent)]">
        {icon}
      </div>
      <div className="text-right">
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
    </div>
  );
}
