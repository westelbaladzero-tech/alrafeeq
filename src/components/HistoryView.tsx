'use client';
import { useEffect, useState } from 'react';
import { Trash2, Inbox, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getTransactions, deleteTransaction } from '@/lib/store';
import type { Transaction } from '@/lib/types';

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', bank: 'تحويل', unknown: 'غير محدد',
};

export default function HistoryView() {
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    const update = () => setTxs(getTransactions());
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  function handleDelete(id: string) {
    deleteTransaction(id);
    setTxs(getTransactions());
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  if (txs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <Inbox size={48} />
        <p>لا توجد عمليات مسجلة بعد</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2 overflow-auto h-full">
      <h2 className="text-xl font-bold mb-2">سجل العمليات</h2>
      {txs.map(t => (
        <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
          }`}>
            {t.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t.category}</span>
              <span className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString('ar-EG')}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
              <span>{METHOD_LABELS[t.method] || t.method} · {t.main === 'work' ? 'عمل' : 'شخصي'}</span>
              <span>{formatDate(t.createdAt)}</span>
            </div>
            {t.note && <div className="text-xs text-gray-300 mt-1 truncate">{t.note}</div>}
          </div>
          <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-400 shrink-0 p-2">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
