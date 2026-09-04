"use client";
import { useState, useEffect } from "react";
import { MessageCircle, Users, Receipt, Shield, LogOut, RefreshCw, UserPlus } from "lucide-react";
import ChatView from "@/components/ChatView";
import PeopleView from "@/components/PeopleView";
import HistoryView from "@/components/HistoryView";
import FriendsView from "@/components/FriendsView";
import AuthGate from "@/components/AuthGate";
import InstallAndSupport from "@/components/InstallAndSupport";
import ConnectionStatus from "@/components/ConnectionStatus";
import { getSupabase } from "@/lib/supabase";
import { initSync } from "@/lib/sync";
import { KEYS } from "@/lib/keys";

type Tab = "chat" | "dashboard" | "history" | "friends";

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");
  const [friendsUnread, setFriendsUnread] = useState(0);

  // استعد التبويب المحفوظ عند التحميل
  useEffect(() => {
    initSync();
    const saved = localStorage.getItem("alrafeeq-tab");
    if (saved && ["chat", "friends", "dashboard", "history"].includes(saved)) {
      setTab(saved as Tab);
    }
  }, []);

  // احفظ التبويب عند تغييره
  useEffect(() => {
    localStorage.setItem("alrafeeq-tab", tab);
  }, [tab]);

  // امنع زر الرجوع من الخروج من التطبيق
  useEffect(() => {
    if (typeof window === "undefined") return;
    // أضف حالة للتاريخ حتى لا يخرج زر الرجوع من التطبيق
    window.history.pushState({ app: "alrafeeq" }, "");
    const handler = (e: PopStateEvent) => {
      // أعد الدفع ليبقى داخل التطبيق
      window.history.pushState({ app: "alrafeeq" }, "");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // استمع لتحديثات عدد الرسائل غير المقروءة من FriendsView
  useEffect(() => {
    function handleUnreadUpdate(e: Event) {
      const total = (e as CustomEvent).detail as number;
      if (tab !== "friends") {
        setFriendsUnread(total);
      }
    }
    window.addEventListener("friends-unread-update", handleUnreadUpdate);
    return () => window.removeEventListener("friends-unread-update", handleUnreadUpdate);
  }, [tab]);

  function openTab(t: Tab) {
    setTab(t);
    if (t === "friends") setFriendsUnread(0);
  }

  async function handleLogout() {
    // امسح المعرّفات المحلية المخزنة لمنع تسريب البيانات بين الحسابات
    if (typeof window !== "undefined") {
      localStorage.removeItem(KEYS.userId);
      localStorage.removeItem(KEYS.clientId);
    }
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    window.location.reload();
  }

  return (
    <AuthGate>
      <main className="h-screen flex flex-col bg-[var(--bg)]">
        {/* الهيدر */}
        <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-[var(--soft)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-[var(--accent-dark)] leading-tight">الرفيق الأمين</div>
              <div className="text-[9px] text-[var(--muted)]">رفيقك في كل مالك</div>
            </div>
            <a href="/admin" className="text-[10px] text-gray-300 hover:text-violet-500 cursor-pointer select-none px-1" aria-hidden="true" title="·">·</a>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => window.location.reload()} className="w-8 h-8 rounded-lg hover:bg-[var(--soft)] flex items-center justify-center text-[var(--accent)] transition" title="تحديث">
              <RefreshCw size={15} />
            </button>
            <button onClick={handleLogout} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-400 transition" title="خروج">
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* آية كريمة */}
        <div className="bg-gradient-to-l from-green-50/50 to-transparent text-center py-1 px-4 shrink-0">
          <p className="text-[10px] text-gray-400 font-medium">
            ﴿ وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ ﴾
          </p>
        </div>

        {/* بانر التثبيت + شريط أدوات */}
        <InstallAndSupport />

        {/* مؤشر الاتصال */}
        <ConnectionStatus />

        {/* المحتوى */}
        <section className="flex-1 overflow-hidden">
          {tab === "chat" && <ChatView />}
          {tab === "dashboard" && <PeopleView />}
          {tab === "history" && <HistoryView />}
          {tab === "friends" && <FriendsView />}
        </section>

        {/* التبويبات */}
        <nav className="flex justify-around py-1.5 px-2 bg-white border-t border-[var(--soft)] shrink-0">
          <TabBtn active={tab === "chat"} onClick={() => openTab("chat")} icon={<MessageCircle size={20} />} label="محادثة" />
          <TabBtn active={tab === "friends"} onClick={() => openTab("friends")} icon={<UserPlus size={20} />} label="أصدقاء" badge={friendsUnread} />
          <TabBtn active={tab === "dashboard"} onClick={() => openTab("dashboard")} icon={<Users size={20} />} label="حسابات" />
          <TabBtn active={tab === "history"} onClick={() => openTab("history")} icon={<Receipt size={20} />} label="سجل" />
        </nav>
      </main>
    </AuthGate>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className={"relative flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-xl transition " + (active ? "text-[var(--accent)] font-bold" : "text-gray-400")}>
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -left-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}
