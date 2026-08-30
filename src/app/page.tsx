"use client";
import { useState } from "react";
import { MessageCircle, Users, Receipt, Wallet, LogOut } from "lucide-react";
import ChatView from "@/components/ChatView";
import PeopleView from "@/components/PeopleView";
import HistoryView from "@/components/HistoryView";
import AuthGate from "@/components/AuthGate";
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
      <main className="min-h-screen flex flex-col items-center">
        <header className="w-full max-w-3xl px-5 py-4 flex items-center justify-between bg-white">
          <div>
            <div className="text-2xl font-bold">الرفيق الأمين</div>
            <div className="text-xs text-gray-400">رفيقك في كل مالك</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--soft)] flex items-center justify-center">
              <Wallet size={20} className="text-[var(--accent)]" />
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 p-2" title="تسجيل الخروج">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="w-full max-w-3xl flex-1 px-4 pb-24">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-[68vh] flex flex-col">
            {tab === "chat" && <ChatView />}
            {tab === "dashboard" && <PeopleView />}
            {tab === "history" && <HistoryView />}
          </div>
        </section>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 px-4 max-w-3xl mx-auto">
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
    <button onClick={onClick} className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition ${active ? "text-[var(--accent)]" : "text-gray-400"}`}>
      {icon}<span className="text-xs">{label}</span>
    </button>
  );
}
