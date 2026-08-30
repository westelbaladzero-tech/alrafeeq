"use client";
import { useEffect, useState, useMemo } from "react";
import { Users, UserCheck, ArrowDownLeft, ArrowUpRight, Hand } from "lucide-react";
import { getTransactions } from "@/lib/store";
import type { Transaction } from "@/lib/types";

interface PersonData {
  name: string;
  gave: number;  // المبلغ اللي أعطاه المستخدم (دين للشخص)
  received: number;  // المبلغ اللي رجع للشخص
  transactions: Transaction[];
}

export default function PeopleView() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

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

  const people = useMemo<PersonData[]>(() => {
    const map: Record<string, PersonData> = {};
    for (const t of txs) {
      if (!t.person) continue;
      if (!map[t.person]) map[t.person] = { name: t.person, gave: 0, received: 0, transactions: [] };
      if (t.type === "expense") map[t.person].gave += t.amount;
      else map[t.person].received += t.amount;
      map[t.person].transactions.push(t);
    }
    return Object.values(map).sort((a, b) => {
      const aNet = a.gave - a.received;
      const bNet = b.gave - b.received;
      return Math.abs(bNet) - Math.abs(aNet);
    });
  }, [txs]);

  const totals = useMemo(() => {
    let receivable = 0; // لـك (الناس عليهم لك)
    let payable = 0;   // علـيك (انت عليهم)
    for (const p of people) {
      const net = p.gave - p.received;
      if (net > 0) receivable += net;
      else payable += Math.abs(net);
    }
    return { receivable, payable };
  }, [people]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) +
      " · " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>;
  }

  const selectedPerson = selected ? people.find(p => p.name === selected) : null;

  return (
    <div className="h-full overflow-auto">
      {/* ملخص الحسابات */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white p-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={22} /> الحسابات
          </h2>
          <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{people.length} شخص</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <ArrowDownLeft size={18} className="mx-auto mb-1 opacity-80" />
            <div className="text-xs opacity-80">لـك (مستحق)</div>
            <div className="font-bold text-lg">{totals.receivable.toLocaleString("ar-EG")}</div>
          </div>
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <ArrowUpRight size={18} className="mx-auto mb-1 opacity-80" />
            <div className="text-xs opacity-80">علـيك (مستحق عليك)</div>
            <div className="font-bold text-lg">{totals.payable.toLocaleString("ar-EG")}</div>
          </div>
        </div>
      </div>

      {/* قائمة الأشخاص */}
      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
          <Users size={48} />
          <p>لا توجد حسابات بعد</p>
          <p className="text-xs">جرّب في المحادثة: "محمد أخذ ٥٠٠"</p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {people.map(p => {
            const net = p.gave - p.received;
            const isOwed = net > 0; // لـك
            return (
              <div key={p.name} className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                <button
                  onClick={() => setSelected(selected === p.name ? null : p.name)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/50 transition"
                >
                  <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold " +
                    (isOwed ? "bg-[var(--accent)]" : "bg-red-300")}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.transactions.length} عملية</div>
                  </div>
                  <div className="text-left">
                    <div className={"font-bold " + (isOwed ? "text-green-600" : "text-red-500")}>
                      {isOwed ? "لـك" : "علـيك"}
                    </div>
                    <div className={"text-sm font-bold " + (isOwed ? "text-green-600" : "text-red-500")}>
                      {Math.abs(net).toLocaleString("ar-EG")}
                    </div>
                  </div>
                </button>
                {/* تفاصيل الشخص المحدد */}
                {selected === p.name && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {p.transactions.map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3">
                        <div className={"w-7 h-7 rounded-full flex items-center justify-center shrink-0 " +
                          (t.type === "income" ? "bg-green-100 text-green-600" : "bg-red-50 text-red-500")}>
                          {t.type === "income" ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {t.type === "income" ? "ردّ لك" : "أخذ منك"}
                            </span>
                            <span className={"text-sm font-bold " +
                              (t.type === "income" ? "text-green-600" : "text-red-500")}>
                              {t.type === "income" ? "+" : "-"}{t.amount.toLocaleString("ar-EG")}
                            </span>
                          </div>
                          <div className="text-xs text-gray-300">{formatDate(t.createdAt)}</div>
                          {t.note && <div className="text-xs text-gray-400 mt-0.5">{t.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
