'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Check, Bot, UserRound } from 'lucide-react';
import { parseTransaction, formatProposal } from '@/lib/parser';
import { addTransaction } from '@/lib/store';
import type { ChatMessage, Proposal } from '@/lib/types';

const WELCOME = 'أهلًا بك 👋 أنا الرفيق — الصديق الأمين. أخبرني بما صرفت أو ما حصلت عليه من دخل، وسأتولى فهمه وتنظيمه لك.';

export default function ChatView() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'bot', text: WELCOME }]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, proposal]);

  function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setMessages(x => [...x, { role: 'user', text }]);
    setInput('');
    const p = parseTransaction(text);
    if (p) {
      setProposal(p);
      setMessages(x => [...x, { role: 'bot', text: formatProposal(p) }]);
    } else {
      setMessages(x => [...x, {
        role: 'bot',
        text: 'أحتاج فقط إلى المبلغ ونوع المصروف حتى أجهز لك اقتراحًا واضحًا. مثال: "دفعت 250 جنيه بنزين"',
      }]);
    }
  }

  async function confirm() {
    if (!proposal) return;
    setSaving(true);
    await addTransaction({
      type: proposal.type,
      amount: proposal.amount,
      category: proposal.category,
      main: proposal.main,
      method: proposal.method,
      note: proposal.note,
    });
    setSaving(false);
    setMessages(x => [...x, {
      role: 'bot',
      text: `✅ تم اعتماد العملية وحفظها: ${proposal.amount.toLocaleString('ar-EG')} جنيه — ${proposal.type === 'income' ? 'وارد' : 'مصروف'} → ${proposal.category}`,
    }]);
    setProposal(null);
  }

  function reject() {
    setMessages(x => [...x, { role: 'bot', text: 'تم إلغاء الاقتراح. اكتب عملية جديدة عندما تريد.' }]);
    setProposal(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            {m.role === 'bot' && <div className="w-9 h-9 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0"><Bot size={18} /></div>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-line ${m.role === 'user' ? 'bg-gray-100' : 'bg-[var(--soft)]'}`}>
              {m.text}
            </div>
            {m.role === 'user' && <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0"><UserRound size={18} /></div>}
          </div>
        ))}
        {proposal && (
          <div className="bg-white border-2 border-[var(--accent)] rounded-2xl p-4 max-w-[85%] mr-auto shadow-sm">
            <div className="font-bold mb-2 flex items-center gap-2">
              <Check size={16} className="text-[var(--accent)]" /> مراجعة العملية
            </div>
            <div className="text-sm space-y-1">
              <div>💰 {proposal.amount.toLocaleString('ar-EG')} جنيه</div>
              <div>📁 {proposal.main === 'work' ? 'عمل' : 'شخصي'} → {proposal.category}</div>
              <div>💳 {methodLabel(proposal.method)}</div>
              <div className="text-gray-400 text-xs mt-1">{proposal.note}</div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={confirm} disabled={saving} className="flex-1 rounded-xl bg-[var(--accent)] text-white py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-50">
                <Check size={18} /> {saving ? 'جاري الحفظ...' : 'تأكيد'}
              </button>
              <button onClick={reject} className="rounded-xl bg-gray-100 text-gray-600 px-5">إلغاء</button>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="مثال: دفعت 250 جنيه بنزين" className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100" />
          <button onClick={send} className="w-12 h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0"><Send size={19} /></button>
        </div>
      </div>
    </div>
  );
}

function methodLabel(m: string): string {
  const map: Record<string, string> = { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة إلكترونية', bank: 'تحويل بنكي', unknown: 'غير محدد' };
  return map[m] || 'غير محدد';
}
