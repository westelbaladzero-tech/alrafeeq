"use client";
import { useState } from "react";
import { MessageCircle, Users, Receipt, Shield, LogOut, RefreshCw } from "lucide-react";
import ChatView from "@/components/ChatView";
import PeopleView from "@/components/PeopleView";
import HistoryView from "@/components/HistoryView";
import AuthGate from "@/components/AuthGate";
import InstallAndSupport from "@/components/InstallAndSupport";
import { getSupabase } from "@/lib/supabase";

type Tab = "chat" | "dashboard" | "history";

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");

  async function handleLogout() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    window.location.reload();
  }

  return (
    <AuthGate>
      <InstallAndSupport />
      <main className="h-screen flex flex-col bg-[var(--bg)]">
        {/* الهيدر */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[var(--soft)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--accent-dark)]">الرفيق الأمين</div>
              <div className="text-[10px] text-[var(--muted)]">رفيقك في كل مالك</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => window.location.reload()} className="w-9 h-9 rounded-xl hover:bg-[var(--soft)] flex items-center justify-center text-[var(--accent)] transition" title="إعادة تحديث">
              <RefreshCw size={16} />
            </button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-xl hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-400 transition" title="خروج">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* المحتوى */}
        <section className="flex-1 overflow-hidden">
          {tab === "chat" && <ChatView />}
          {tab === "dashboard" && <PeopleView />}
          {tab === "history" && <HistoryView />}
        </section>

        {/* التبويبات */}
        <nav className="flex justify-around py-1.5 px-2 bg-white border-t border-[var(--soft)] shrink-0">
          <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} icon={<MessageCircle size={20} />} label="محادثة" />
          <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<Users size={20} />} label="حسابات" />
          <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<Receipt size={20} />} label="سجل" />
        </nav>
      </main>
    </AuthGate>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={"flex flex-col items-center gap-0.5 px-8 py-1.5 rounded-xl transition " + (active ? "text-[var(--accent)] font-bold" : "text-gray-400")}>
      {icon}<span className="text-[11px]">{label}</span>
    </button>
  );
}
