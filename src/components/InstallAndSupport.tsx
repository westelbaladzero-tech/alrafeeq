"use client";
import { useEffect, useState } from "react";
import { Download, MessageCircle, X, RefreshCw } from "lucide-react";

const WHATSAPP_NUMBER = "201050909821"; // ضع رقمك هنا

export default function InstallAndSupport() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // فحص إذا كان مثبت
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setInstalled(isStandalone);

    // التقاط حدث التثبيت
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

    // إظهار البانر بعد 3 ثواني لو غير مثبت
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
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  }

  return (
    <>
      {/* بانر التثبيت */}
      {showBanner && !installed && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--accent)] text-white px-4 py-3 flex items-center gap-3 shadow-lg animate-[slideDown_0.3s_ease]">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Download size={20} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">ثبّت الرفيق الأمين</div>
            <div className="text-xs opacity-80">على شاشتك الرئيسية للوصول السريع</div>
          </div>
          <button onClick={handleInstall}
            className="bg-white text-[var(--accent)] text-xs font-bold px-3 py-1.5 rounded-lg shrink-0">
            تثبيت
          </button>
          <button onClick={() => setShowBanner(false)} className="opacity-70 shrink-0">
            <X size={18} />
          </button>
        </div>
      )}

      {/* شريط أدوات علوي */}
      <div className="fixed top-3 left-3 z-40 flex gap-2">
        {/* زر التثبيت / فتح التطبيق */}
        {installEvent && !installed && (
          <button onClick={handleInstall}
            className="w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg active:scale-90 transition"
            title="تثبيت التطبيق">
            <Download size={20} />
          </button>
        )}

        {/* زر إعادة التحديث */}
        <button onClick={() => window.location.reload()}
          className="w-12 h-12 rounded-full bg-[var(--accent-dark)] text-white flex items-center justify-center shadow-lg active:scale-90 transition"
          title="إعادة تحديث">
          <RefreshCw size={20} />
        </button>

        {/* زر الواتساب */}
        <button onClick={openWhatsApp}
          className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg active:scale-90 transition"
          title="تواصل مع الدعم">
          <MessageCircle size={20} />
        </button>
      </div>
    </>
  );
}
