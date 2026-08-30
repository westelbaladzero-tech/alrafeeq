"use client";
import { useEffect, useState } from "react";
import { Download, MessageCircle, X } from "lucide-react";

const WHATSAPP_NUMBER = "201050909821";

export default function InstallAndSupport() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setInstalled(isStandalone);

    const handler = (e: any) => {
      e.preventDefault();
      setInstallEvent(e);
      if (!isStandalone) setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowBanner(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    if (!isStandalone) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
        window.removeEventListener("appinstalled", installedHandler);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setShowBanner(false);
    }
    setInstallEvent(null);
  }

  function openWhatsApp() {
    const msg = encodeURIComponent("السلام عليكم، محتاج مساعدة في تطبيق الرفيق الأمين");
    window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + msg, "_blank");
  }

  return (
    <>
      {/* بانر التثبيت — يدفن المحتوى مو يغطيه */}
      {showBanner && !installed && (
        <div className="bg-[var(--accent)] text-white px-4 py-2 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Download size={16} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold">ثبّت الرفيق الأمين</div>
            <div className="text-[10px] opacity-80">على شاشتك الرئيسية للوصول السريع</div>
          </div>
          <button onClick={handleInstall}
            className="bg-white text-[var(--accent)] text-xs font-bold px-3 py-1 rounded-lg shrink-0">
            تثبيت
          </button>
          <button onClick={() => setShowBanner(false)} className="opacity-70 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* شريط أدوات رفيع — حدود شاشة مو عائم */}
      <div className="flex items-center justify-center gap-6 px-4 py-1 bg-white border-t border-[var(--soft)] shrink-0">
        {installEvent && !installed && (
          <button onClick={handleInstall}
            className="flex items-center gap-1 text-xs text-[var(--accent)] font-bold">
            <Download size={14} /> تثبيت
          </button>
        )}
        {installed && (
          <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <Download size={14} /> مثبت
          </div>
        )}
        <button onClick={openWhatsApp}
          className="flex items-center gap-1 text-xs text-[#25D366] font-bold">
          <MessageCircle size={14} /> دعم
        </button>
      </div>
    </>
  );
}
