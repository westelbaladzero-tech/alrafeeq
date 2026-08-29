'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';
import { getStats } from '@/lib/store';

export default function DashboardView() {
  const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0, count: 0, topCategories: [] as [string, number][] });

  useEffect(() => {
    const update = () => setStats(getStats());
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  const maxCat = stats.topCategories.length ? Math.max(...stats.topCategories.map(c => c[1])) : 1;

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <h2 className="text-xl font-bold mb-2">الملخص المالي</h2>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 text-sm">الرصيد الحالي</span>
          <Wallet size={20} className="text-[var(--accent)]" />
        </div>
        <div className={`text-3xl font-bold ${stats.balance >= 0 ? 'text-[var(--accent)]' : 'text-red-500'}`}>
          {stats.balance.toLocaleString('ar-EG')} <span className="text-base font-normal">جنيه</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">إجمالي {stats.count} عملية</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm">وارد</span>
          </div>
          <div className="text-xl font-bold text-green-600">{stats.income.toLocaleString('ar-EG')}</div>
          <div className="text-xs text-gray-400">جنيه</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <TrendingDown size={18} />
            <span className="text-sm">مصروف</span>
          </div>
          <div className="text-xl font-bold text-red-500">{stats.expense.toLocaleString('ar-EG')}</div>
          <div className="text-xs text-gray-400">جنيه</div>
        </div>
      </div>

      {stats.topCategories.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-[var(--accent)]" />
            <h3 className="font-bold">أعلى الفئات صرفاً</h3>
          </div>
          <div className="space-y-3">
            {stats.topCategories.map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{cat}</span>
                  <span className="text-gray-500">{amt.toLocaleString('ar-EG')}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${(amt / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.count === 0 && (
        <div className="text-center text-gray-400 py-8">
          لا توجد عمليات بعد. ابدأ بمحادثة الرفيق لتسجيل أول مصروف أو دخل.
        </div>
      )}
    </div>
  );
}
