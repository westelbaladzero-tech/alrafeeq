"use client";
import { useEffect, useState, useMemo } from "react";
import { Trash2, Inbox, ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { getTransactions, deleteTransaction } from "@/lib/store";
import type { Transaction } from "@/lib/types";

type Filter = "all" | "today" | "week" | "month";

const METHOD_LABELS: Record<string, string> = {
  cash: "نقدي", card: "بطاقة", wallet: "محفظة", bank: "تحويل", unknown: "غير محدد",
};

const CATEGORY_ICONS: Record<string, string> = {
  "مطاعم": "🍽️", "مواصلات": "🚗", "فواتير": "📄", "تسوق": "🛍️",
  "صحة": "💊", "تعليم": "📚", "ترفيه": "🎮", "إيجار": "🏠",
  "راتب": "💼", "أرباح": "💰", "عمولة": "🤝", "أخرى": "📦",
};

export default function HistoryView() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await getTransactions();
      if (mounted) { setTxs(data); setLoading(false); }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    setTxs(prev => prev.filter(t => t.id !== id));
  }

  // الفلترة الزمنية
  const filtered = useMemo(() => {
    if (filter === "all") return txs;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return txs.filter(t => {
      const d = new Date(t.createdAt);
      if (filter === "today") return d >= startToday;
      if (filter === "week") return d >= startWeek;
      if (filter === "month") return d >= startMonth;
      return true;
    });
  }, [txs, filter]);

  // المجاميع
  const totals = useMemo(() => {
    const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, count: filtered.length };
  }, [filtered]);

  // تجميع حسب الفئة
  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of filtered) {
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    }
    return Object.entries(map).sort((a, b) => {
      const aTotal = a[1].reduce((s, t) => s + t.amount, 0);
      const bTotal = b[1].reduce((s, t) => s + t.amount, 0);
      return bTotal - aTotal;
    });
  }, [filtered]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) +
      " · " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "today", label: "اليوم" },
    { key: "week", label: "الأسبوع" },
    { key: "month", label: "الشهر" },
  ];

  return (
    <div className="h-full overflow-auto">
      {/* ملخص عام */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-emerald-600 text-white p-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">سجل العمليات</h2>
          <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{totals.count} عملية</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <TrendingDown size={18} className="mx-auto mb-1 opacity-80" />
            <div className="text-xs opacity-80">المصروفات</div>
            <div className="font-bold">{totals.expense.toLocaleString("ar-EG")}</div>
          </div>
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <TrendingUp size={18} className="mx-auto mb-1 opacity-80" />
            <div className="text-xs opacity-80">الدخل</div>
            <div className="font-bold">{totals.income.toLocaleString("ar-EG")}</div>
          </div>
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <Wallet size={18} className="mx-auto mb-1 opacity-80" />
            <div className="text-xs opacity-80">الرصيد</div>
            <div className="font-bold">{totals.balance.toLocaleString("ar-EG")}</div>
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={"px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition " +
              (filter === f.key
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "bg-gray-100 text-gray-500")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* المعاملات مجمّعة بالفئات */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
          <Inbox size={48} />
          <p>لا توجد عمليات في هذه الفترة</p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-4">
          {grouped.map(([category, items]) => {
            const catTotal = items.reduce((s, t) => s + t.amount, 0);
            const catIncome = items.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const catExpense = items.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            const icon = CATEGORY_ICONS[category] || "📦";

            return (
              <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                {/* رأس الفئة */}
                <div className="flex items-center justify-between p-3 bg-gray-50/50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <span className="font-bold text-sm">{category}</span>
                    <span className="text-xs text-gray-400">({items.length})</span>
                  </div>
                  <div className="text-left">
                    {catIncome > 0 && catExpense === 0 && (
                      <span className="font-bold text-green-600 text-sm">+{catIncome.toLocaleString("ar-EG")}</span>
                    )}
                    {catExpense > 0 && catIncome === 0 && (
                      <span className="font-bold text-red-500 text-sm">-{catExpense.toLocaleString("ar-EG")}</span>
                    )}
                    {catIncome > 0 && catExpense > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-green-600 text-xs">+{catIncome.toLocaleString("ar-EG")}</span>
                        <span className="text-red-500 text-xs">-{catExpense.toLocaleString("ar-EG")}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* المعاملات */}
                <div className="divide-y divide-gray-50">
                  {items.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 hover:bg-gray-50/50 transition">
                      <div className={"w-8 h-8 rounded-full flex items-center justify-center shrink-0 " +
                        (t.type === "income" ? "bg-green-100 text-green-600" : "bg-red-50 text-red-500")}>
                        {t.type === "income" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{t.note || t.category}</span>
                          <span className={"text-sm font-bold shrink-0 " +
                            (t.type === "income" ? "text-green-600" : "text-red-500")}>
                            {t.type === "income" ? "+" : "-"}{t.amount.toLocaleString("ar-EG")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{METHOD_LABELS[t.method] || t.method}</span>
                            {t.main === "work" && <span className="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded text-[10px]">عمل</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {formatDate(t.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(t.id)} className="text-gray-200 hover:text-red-400 shrink-0 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
