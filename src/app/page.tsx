'use client';
import { useState } from 'react';
import { MessageCircle, BarChart3, Receipt, Wallet } from 'lucide-react';
import ChatView from '@/components/ChatView';
import DashboardView from '@/components/DashboardView';
import HistoryView from '@/components/HistoryView';

type Tab = 'chat' | 'dashboard' | 'history';

export default function Home() {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <main className="min-h-screen flex flex-col items-center">
      <header className="w-full max-w-3xl px-5 py-5 flex items-center justify-between bg-white">
        <div>
          <div className="text-2xl font-bold">الرفيق</div>
          <div className="text-sm text-gray-500">الصديق الأمين لإدارة أموالك</div>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-[var(--soft)] flex items-center justify-center">
          <Wallet size={22} className="text-[var(--accent)]" />
        </div>
      </header>

      <section className="w-full max-w-3xl flex-1 px-4 pb-24">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-[72vh] flex flex-col">
          {tab === 'chat' && <ChatView />}
          {tab === 'dashboard' && <DashboardView />}
          {tab === 'history' && <HistoryView />}
        </div>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 px-4 max-w-3xl mx-auto">
        <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessageCircle size={20} />} label="محادثة" />
        <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<BarChart3 size={20} />} label="ملخص" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<Receipt size={20} />} label="سجل" />
      </nav>
    </main>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition ${active ? 'text-[var(--accent)]' : 'text-gray-400'}`}>
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}
