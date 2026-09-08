"use client";
import { useState, useEffect } from "react";
import { CreditCard, Wallet, X, Plus, Trash2, Loader2, Check, Landmark } from "lucide-react";
import { getResolvedUserId } from "@/lib/client-id";

interface Method {
  id: string;
  method: string;
  identifier: string | null;
  display_name: string | null;
  is_primary: boolean;
  bank_name?: string | null;
  iban?: string | null;
  card_type?: string | null;
  last_four?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  etisalat_cash: "اتصالات كاش",
  orange_cash: "أورانج كاش",
  we_cash: "وي كاش",
  bank_account: "حساب بنكي",
  card: "بطاقة",
  other: "أخرى",
};

export default function PaymentMethodsModal({ onClose }: { onClose: () => void }) {
  const [uid, setUid] = useState<string | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [method, setMethod] = useState("vodafone_cash");
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [cardType, setCardType] = useState("visa");
  const [lastFour, setLastFour] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    getResolvedUserId().then(id => {
      if (id) { setUid(id); loadMethods(id); }
      else setLoading(false);
    });
  }, []);

  async function loadMethods(id: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/payment-methods", { headers: { "x-client-id": id } });
      const data = await res.json();
      if (data.ok) setMethods(data.methods || []);
    } catch {}
    setLoading(false);
  }

  async function addMethod() {
    if (!uid) return;
    setSubmitting(true);
    setErr("");
    try {
      const body: Record<string, unknown> = { method, is_primary: isPrimary };
      if (identifier) body.identifier = identifier;
      if (displayName) body.display_name = displayName;
      if (method === "bank_account") {
        body.bank_name = bankName;
        if (iban) body.iban = iban;
      }
      if (method === "card") {
        body.card_type = cardType;
        body.last_four = lastFour;
      }
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": uid },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setShowAdd(false);
        setIdentifier(""); setDisplayName(""); setBankName("");
        setIban(""); setLastFour(""); setIsPrimary(false);
        loadMethods(uid);
      } else {
        setErr(data.error || "تعذّر الإضافة");
      }
    } catch {
      setErr("خطأ في الاتصال");
    }
    setSubmitting(false);
  }

  async function deleteMethod(id: string) {
    if (!uid) return;
    try {
      const res = await fetch("/api/payment-methods?id=" + id, {
        method: "DELETE",
        headers: { "x-client-id": uid },
      });
      const data = await res.json();
      if (data.ok) loadMethods(uid);
    } catch {}
  }

  const needsIdentifier = method !== "card" && method !== "bank_account";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard size={22} className="text-violet-600" />
            وسائل الدفع
          </h2>
          <button onClick={onClose} className="text-gray-400"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-violet-500" /></div>
          ) : methods.length === 0 ? (
            <div className="text-center py-8">
              <Wallet size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400 mb-1">لم تسجّل أي وسيلة بعد</p>
              <p className="text-xs text-gray-300">سجّل وسائلك ليتمكن أصدقاؤك من الإرسال إليك</p>
            </div>
          ) : (
            methods.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  {m.method === "bank_account" ? <Landmark size={18} className="text-violet-600" /> :
                   m.method === "card" ? <CreditCard size={18} className="text-violet-600" /> :
                   <Wallet size={18} className="text-violet-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold flex items-center gap-2">
                    {METHOD_LABELS[m.method] || m.method}
                    {m.is_primary && <span className="text-[9px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">رئيسي</span>}
                  </div>
                  {m.method === "card" ? (
                    <div className="text-xs text-gray-500" dir="ltr">{(m.card_type||"").toUpperCase()} .... {m.last_four}</div>
                  ) : m.method === "bank_account" ? (
                    <div className="text-xs text-gray-500">
                      {m.bank_name}{m.identifier ? " - " + m.identifier : ""}{m.iban ? " (IBAN)" : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500" dir="ltr">{m.identifier}</div>
                  )}
                </div>
                <button onClick={() => deleteMethod(m.id)} className="text-red-400 hover:text-red-600 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-600 rounded-2xl py-3 font-bold text-sm">
              <Plus size={18} /> أضف وسيلة دفع
            </button>
          )}
          {showAdd && (
            <div className="bg-violet-50/50 rounded-2xl p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">الوسيلة</label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100">
                  <optgroup label="محافظ إلكترونية">
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="etisalat_cash">اتصالات كاش</option>
                    <option value="orange_cash">أورانج كاش</option>
                    <option value="we_cash">وي كاش</option>
                  </optgroup>
                  <option value="instapay">إنستاباي</option>
                  <option value="bank_account">حساب بنكي</option>
                  <option value="card">بطاقة (آخر 4 أرقام)</option>
                </select>
              </div>
              {needsIdentifier && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">
                    {method === "instapay" ? "IPA (name@instapay)" : "رقم الهاتف (01xxxxxxxxx)"}
                  </label>
                  <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                    placeholder={method === "instapay" ? "name@instapay" : "01xxxxxxxxx"} dir="ltr"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100" />
                </div>
              )}
              {method === "bank_account" && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">اسم البنك</label>
                    <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                      placeholder="البنك الأهلي المصري" dir="rtl"
                      className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">رقم الحساب</label>
                    <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                      dir="ltr" className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">IBAN (اختياري)</label>
                    <input type="text" value={iban} onChange={e => setIban(e.target.value)} dir="ltr"
                      className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100" />
                  </div>
                </>
              )}
              {method === "card" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">النوع</label>
                    <select value={cardType} onChange={e => setCardType(e.target.value)}
                      className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100">
                      <option value="visa">Visa</option>
                      <option value="mastercard">Mastercard</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">آخر 4 أرقام</label>
                    <input type="text" value={lastFour} onChange={e => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4} dir="ltr" placeholder="1234"
                      className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <p className="text-[10px] text-amber-600 col-span-2">لا تدخل الرقم الكامل أو CVV — آخر 4 أرقام فقط</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">اسم عرضي (اختياري)</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="محفظتي الرئيسية" dir="rtl"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs text-gray-600">اجعلها الوسيلة الرئيسية</span>
              </label>
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={addMethod} disabled={submitting}
                  className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  حفظ
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-4 bg-gray-100 text-gray-500 rounded-xl py-2.5 text-sm font-bold">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
