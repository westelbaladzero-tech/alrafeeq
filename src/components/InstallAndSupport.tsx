"use client";
import { useEffect, useState } from "react";
import { Download, MessageCircle, X, Share } from "lucide-react";

const WHATSAPP_NUMBER = "201050909821";

export default function InstallAndSupport() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

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
    if (installEvent) {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setShowBanner(false);
      }
      setInstallEvent(null);
      return;
    }
    setShowGuide(true);
  }

  function openWhatsApp() {
    const msg = encodeURIComponent("السلام عليكم، محتاج مساعدة في تطبيق الرفيق الأمين");
    window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + msg, "_blank");
  }

  const isIOS = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  return (
    <>
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

      <div className="flex items-center justify-center gap-6 px-4 py-1 bg-white border-t border-[var(--soft)] shrink-0">
        {!installed && (
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

      {showGuide && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowGuide(false)}>
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[var(--accent-dark)]">تثبيت التطبيق</h3>
              <button onClick={() => setShowGuide(false)} className="text-gray-300">
                <X size={18} />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">للتثبيت على iPhone:</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Share size={14} className="text-blue-500" />
                  </span>
                  <span>اضغط زر المشاركة <strong>في أسفل Safari</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-500 font-bold text-xs">2</span>
                  <span>اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-500 font-bold text-xs">3</span>
                  <span>اضغط <strong>«إضافة»</strong></span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">للتثبيت على Android:</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0 text-green-600 font-bold text-xs">1</span>
                  <span>اضغط <strong>القائمة ⋮</strong> في Chrome</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0 text-green-600 font-bold text-xs">2</span>
                  <span>اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0 text-green-600 font-bold text-xs">3</span>
                  <span>اضغط <strong>«تثبيت»</strong></span>
                </div>
              </div>
            )}

            <button onClick={() => setShowGuide(false)}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-2.5 font-bold text-sm mt-4">
              تم
            </button>
          </div>
        </div>
      )}
    </>
  );
}
