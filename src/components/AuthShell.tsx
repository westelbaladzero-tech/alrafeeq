"use client";
import { Wallet, Shield, Sparkles } from "lucide-react";

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-screen min-h-screen overflow-hidden relative">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />

      <div className="max-w-md mx-auto min-h-screen px-5 py-6 flex flex-col justify-center relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-extrabold text-[var(--accent)]">الرفيق</div>
            <div className="text-sm text-[var(--muted)]">مجلس المال الشخصي</div>
          </div>
          <div className="w-16 h-16 rounded-[22px] bg-white/75 backdrop-blur shadow-sm border border-white/60 flex items-center justify-center">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
        </div>

        <div className="mb-5">
          {eyebrow && (
            <div className="text-sm text-[var(--accent)] font-semibold mb-2 flex items-center gap-2">
              <Sparkles size={15} />
              <span>{eyebrow}</span>
            </div>
          )}
          <h1 className="text-[2rem] leading-tight font-extrabold text-[var(--accent)] mb-3">{title}</h1>
          {description && <p className="text-sm leading-7 text-[var(--muted)]">{description}</p>}
        </div>

        <div className="auth-hero-card mb-5">
          <div className="auth-hero-badge">
            <Shield size={14} />
            <span>مراجعة قبل الاعتماد</span>
          </div>
          <div className="auth-hero-visual">
            <div className="auth-note" />
            <div className="auth-leaf auth-leaf-1" />
            <div className="auth-leaf auth-leaf-2" />
            <div className="auth-fab">
              <Shield size={16} />
            </div>
          </div>
        </div>

        <section className="auth-card">{children}</section>
      </div>
    </main>
  );
}
