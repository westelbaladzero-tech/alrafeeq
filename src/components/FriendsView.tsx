"use client";
import { useState, useEffect } from "react";
import { UserPlus, Users, ArrowRight, ArrowLeft, Check, X, Wallet, HandCoins, Banknote, Lock } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getResolvedUserId } from "@/lib/client-id";

interface Friend {
  friendship_id: string;
  friend_id: string;
  friend_phone: string;
  status: string;
  initiator: string;
  balance: number;
}

interface PendingDebt {
  id: string;
  amount: number;
  description: string;
  you_are: "creditor" | "debtor";
  created_at: string;
}

interface PendingSettlement {
  id: string;
  amount: number;
  you_are: "sender" | "receiver";
  created_at: string;
}

export default function FriendsView() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);
  const [pendingSetts, setPendingSetts] = useState<PendingSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showDebt, setShowDebt] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDesc, setDebtDesc] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "debt" | "settlement"; id: string; accept: boolean } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const userId = await getResolvedUserId();
    if (!userId) { setLoading(false); return; }
    setUid(userId);
    await loadFriends(userId);
    await loadPendingDebts(userId);
    await loadPendingSettlements(userId);
    setLoading(false);
  }

  async function loadFriends(userId: string) {
    const sb = getSupabase();
    if (!sb) return;
    const { data: ships } = await sb
      .from("friendships")
      .select("id, user_a, user_b, status, initiator")
      .or("user_a.eq." + userId + ",user_b.eq." + userId);
    if (!ships || ships.length === 0) { setFriends([]); return; }
    const friendList: Friend[] = [];
    for (const ship of ships) {
      const friendId = ship.user_a === userId ? ship.user_b : ship.user_a;
      const { data: profile } = await sb.from("profiles").select("phone").eq("id", friendId).maybeSingle();
      const balance = await calculateBalance(sb, userId, friendId);
      friendList.push({
        friendship_id: ship.id, friend_id: friendId,
        friend_phone: profile?.phone || "غير معروف",
        status: ship.status, initiator: ship.initiator, balance,
      });
    }
    setFriends(friendList);
  }

  async function calculateBalance(sb: any, me: string, friend: string): Promise<number> {
    const { data: myDebts } = await sb.from("debt_requests").select("amount")
      .eq("creditor", me).eq("debtor", friend).eq("status", "confirmed");
    const owed = (myDebts || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    const { data: theirDebts } = await sb.from("debt_requests").select("amount")
      .eq("creditor", friend).eq("debtor", me).eq("status", "confirmed");
    const owe = (theirDebts || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    const { data: mySett } = await sb.from("settlements").select("amount")
      .eq("from_user", me).eq("to_user", friend).eq("status", "confirmed");
    const paid = (mySett || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    const { data: theirSett } = await sb.from("settlements").select("amount")
      .eq("from_user", friend).eq("to_user", me).eq("status", "confirmed");
    const received = (theirSett || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    return (owed - paid) - (owe - received);
  }

  async function loadPendingDebts(userId: string) {
    const sb = getSupabase();
    if (!sb) return;
    const { data: owed } = await sb.from("debt_requests")
      .select("id, amount, description, creditor, debtor, created_at")
      .eq("creditor", userId).eq("status", "pending");
    const { data: owe } = await sb.from("debt_requests")
      .select("id, amount, description, creditor, debtor, created_at")
      .eq("debtor", userId).eq("status", "pending");
    const all: PendingDebt[] = [];
    for (const d of [...(owed || []), ...(owe || [])]) {
      all.push({
        id: d.id, amount: Number(d.amount),
        description: d.description || "",
        you_are: d.creditor === userId ? "creditor" : "debtor",
        created_at: d.created_at,
      });
    }
    setPendingDebts(all);
  }

  async function loadPendingSettlements(userId: string) {
    const sb = getSupabase();
    if (!sb) return;
    const { data: sent } = await sb.from("settlements")
      .select("id, amount, from_user, to_user, created_at")
      .eq("from_user", userId).eq("status", "pending");
    const { data: received } = await sb.from("settlements")
      .select("id, amount, from_user, to_user, created_at")
      .eq("to_user", userId).eq("status", "pending");
    const all: PendingSettlement[] = [];
    for (const s of [...(sent || []), ...(received || [])]) {
      all.push({
        id: s.id, amount: Number(s.amount),
        you_are: s.from_user === userId ? "sender" : "receiver",
        created_at: s.created_at,
      });
    }
    setPendingSetts(all);
  }

  async function addFriend() {
    setErr("");
    if (!phoneInput || !uid) return;
    setAdding(true);
    const sb = getSupabase();
    if (!sb) { setAdding(false); return; }
    try {
      const { data: target } = await sb.from("profiles").select("id, phone").eq("phone", phoneInput).maybeSingle();
      if (!target) { setErr("الرقم غير مسجل في التطبيق"); setAdding(false); return; }
      if (target.id === uid) { setErr("ما تقدرش تضيف نفسك"); setAdding(false); return; }
      const { data: existing } = await sb.from("friendships")
        .select("id, status, user_a, user_b")
        .or("user_a.eq." + uid + ",user_b.eq." + uid);
      const already = (existing || []).find((f: any) =>
        (f.user_a === uid && f.user_b === target.id) ||
        (f.user_b === uid && f.user_a === target.id));
      if (already) {
        setErr(already.status === "accepted" ? "صديقك بالفعل" : "طلب معلّق بالفعل");
        setAdding(false); return;
      }
      const { error } = await sb.from("friendships").insert({
        user_a: uid, user_b: target.id, status: "pending", initiator: uid,
      });
      if (error) { setErr("تعذّر إضافة الصديق"); setAdding(false); return; }
      setPhoneInput(""); setShowAdd(false); await load();
    } catch { setErr("خطأ في الاتصال"); }
    setAdding(false);
  }

  async function respondFriendship(shipId: string, accept: boolean) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("friendships")
      .update({ status: accept ? "accepted" : "blocked", updated_at: new Date().toISOString() })
      .eq("id", shipId);
    await load();
  }

  async function respondDebt(debtId: string, accept: boolean) {
    // اطلب PIN قبل التأكيد
    setPendingAction({ type: "debt", id: debtId, accept });
    setPinInput(""); setPinErr(""); setShowPin(true);
  }

  async function respondSettlement(settId: string, accept: boolean) {
    // اطلب PIN قبل التأكيد
    setPendingAction({ type: "settlement", id: settId, accept });
    setPinInput(""); setPinErr(""); setShowPin(true);
  }

  async function verifyPinAndExecute() {
    setPinErr("");
    if (!pinInput) { setPinErr("اكتب الرمز"); return; }
    setPinVerifying(true);

    const sb = getSupabase();
    if (!sb) { setPinVerifying(false); return; }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setPinErr("انتهت الجلسة"); setPinVerifying(false); return; }

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput, accessToken: session.access_token }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setPinErr(data.error || "الرمز خاطئ");
        setPinVerifying(false);
        return;
      }

      // PIN صحيح ← نفّذ العملية
      if (pendingAction) {
        const sb2 = getSupabase();
        if (sb2) {
          const table = pendingAction.type === "debt" ? "debt_requests" : "settlements";
          const status = pendingAction.accept ? "confirmed" : "rejected";
          await sb2.from(table)
            .update({ status, confirmed_at: new Date().toISOString() })
            .eq("id", pendingAction.id);
        }
      }

      setShowPin(false);
      setPinInput("");
      setPendingAction(null);
      await load();
    } catch {
      setPinErr("خطأ في الاتصال");
    }
    setPinVerifying(false);
  }

  async function sendDebtRequest() {
    setActionErr("");
    if (!debtAmount || !uid || !selectedFriend) return;
    const amt = Number(debtAmount);
    if (isNaN(amt) || amt <= 0) { setActionErr("مبلغ غير صحيح"); return; }
    setSubmitting(true);
    const sb = getSupabase();
    if (!sb) { setSubmitting(false); return; }
    const { error } = await sb.from("debt_requests").insert({
      creditor: uid,
      debtor: selectedFriend.friend_id,
      friendship_id: selectedFriend.friendship_id,
      amount: amt,
      description: debtDesc || null,
      status: "pending",
    });
    if (error) { setActionErr("تعذّر إرسال الطلب"); setSubmitting(false); return; }
    setDebtAmount(""); setDebtDesc(""); setShowDebt(false); await load();
    setSubmitting(false);
  }

  async function sendSettlement() {
    setActionErr("");
    if (!settleAmount || !uid || !selectedFriend) return;
    const amt = Number(settleAmount);
    if (isNaN(amt) || amt <= 0) { setActionErr("مبلغ غير صحيح"); return; }
    setSubmitting(true);
    const sb = getSupabase();
    if (!sb) { setSubmitting(false); return; }
    const { error } = await sb.from("settlements").insert({
      from_user: uid,
      to_user: selectedFriend.friend_id,
      friendship_id: selectedFriend.friendship_id,
      amount: amt,
      status: "pending",
    });
    if (error) { setActionErr("تعذّر إرسال التسوية"); setSubmitting(false); return; }
    setSettleAmount(""); setShowSettle(false); await load();
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>;
  }

  // ─── صفحة تفاصيل الصديق ───
  if (selectedFriend) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--bg)]">
        <div className="p-4">
          <button onClick={() => setSelectedFriend(null)}
            className="flex items-center gap-1 text-gray-400 text-sm mb-4">
            <ArrowLeft size={16} /> رجوع
          </button>
          <div className="bg-white rounded-2xl p-4 border border-[var(--soft)] mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-[var(--soft)] flex items-center justify-center">
                <Wallet size={22} className="text-[var(--accent)]" />
              </div>
              <div>
                <div className="text-base font-bold">{selectedFriend.friend_phone}</div>
                <div className={"text-sm " + (selectedFriend.balance > 0 ? "text-green-500" : selectedFriend.balance < 0 ? "text-red-400" : "text-gray-400")}>
                  {selectedFriend.balance > 0 ? "لك " + selectedFriend.balance + " جنيه" : selectedFriend.balance < 0 ? "عليك " + Math.abs(selectedFriend.balance) + " جنيه" : "الحساب مسوّى"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setShowDebt(true)}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)]">
              <HandCoins size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">ليّ عنده</span>
            </button>
            <button onClick={() => setShowSettle(true)}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)]">
              <Banknote size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">دفعت له</span>
            </button>
          </div>

          {pendingDebts.filter((d) => d.you_are === "creditor").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">طلبات دين أرسلتها</h3>
              {pendingDebts.filter((d) => d.you_are === "creditor").map((d) => (
                <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-bold">لك {d.amount} جنيه</div>
                    <span className="text-xs text-gray-400">بانتظار الموافقة</span>
                  </div>
                  {d.description && <div className="text-xs text-gray-400 mt-1">{d.description}</div>}
                </div>
              ))}
            </div>
          )}

          {pendingSetts.filter((s) => s.you_are === "sender").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">تسويات أرسلتها</h3>
              {pendingSetts.filter((s) => s.you_are === "sender").map((s) => (
                <div key={s.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-bold">دفعت {s.amount} جنيه</div>
                    <span className="text-xs text-gray-400">بانتظار التأكيد</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* مودال طلب دين */}
        {showDebt && (
          <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setShowDebt(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-1">ليّ عنده</h3>
              <p className="text-xs text-gray-400 mb-4">عندك فلوس عند {selectedFriend.friend_phone}</p>
              <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)}
                placeholder="المبلغ بالجنيه" required
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
              <input type="text" value={debtDesc} onChange={(e) => setDebtDesc(e.target.value)}
                placeholder="وصف (اختياري)"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
              {actionErr && <div className="text-red-500 text-sm mb-2 text-center">{actionErr}</div>}
              <button onClick={sendDebtRequest} disabled={submitting}
                className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
                {submitting ? "جاري الإرسال..." : "إرسال طلب دين"}
              </button>
              <button onClick={() => setShowDebt(false)} className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
            </div>
          </div>
        )}

        {/* مودال تسوية */}
        {showSettle && (
          <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setShowSettle(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-1">دفعت له</h3>
              <p className="text-xs text-gray-400 mb-4">دفعت مبلغ لـ {selectedFriend.friend_phone}</p>
              <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="المبلغ بالجنيه" required
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
              {actionErr && <div className="text-red-500 text-sm mb-2 text-center">{actionErr}</div>}
              <button onClick={sendSettlement} disabled={submitting}
                className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
                {submitting ? "جاري الإرسال..." : "إرسال طلب تأكيد"}
              </button>
              <button onClick={() => setShowSettle(false)} className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── الصفحة الرئيسية للأصدقاء ───
  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--accent-dark)]">الأصدقاء</h2>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-2 rounded-xl text-sm font-bold">
            <UserPlus size={16} /> أضف صديق
          </button>
        </div>

        {friends.filter((f) => f.status === "pending" && f.initiator !== uid).length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-400 mb-2">طلبات صداقة جديدة</h3>
            {friends.filter((f) => f.status === "pending" && f.initiator !== uid).map((f) => (
              <div key={f.friendship_id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">{f.friend_phone}</div>
                  <div className="text-xs text-gray-400">يريد أن يصبح صديقك</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => respondFriendship(f.friendship_id, true)}
                    className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                    <Check size={16} />
                  </button>
                  <button onClick={() => respondFriendship(f.friendship_id, false)}
                    className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingDebts.filter((d) => d.you_are === "debtor").length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-400 mb-2">طلبات ديون عليك</h3>
            {pendingDebts.filter((d) => d.you_are === "debtor").map((d) => (
              <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-bold">عليك {d.amount} جنيه</div>
                  <div className="flex gap-1">
                    <button onClick={() => respondDebt(d.id, true)}
                      className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> موافق
                    </button>
                    <button onClick={() => respondDebt(d.id, false)}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-400 text-xs font-bold flex items-center gap-1">
                      <X size={14} /> رفض
                    </button>
                  </div>
                </div>
                {d.description && <div className="text-xs text-gray-400">{d.description}</div>}
              </div>
            ))}
          </div>
        )}

        {pendingSetts.filter((s) => s.you_are === "receiver").length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-400 mb-2">تأكيد استلام</h3>
            {pendingSetts.filter((s) => s.you_are === "receiver").map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-bold">استلمت {s.amount} جنيه</div>
                  <div className="flex gap-1">
                    <button onClick={() => respondSettlement(s.id, true)}
                      className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> أكدت
                    </button>
                    <button onClick={() => respondSettlement(s.id, false)}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-400 text-xs font-bold flex items-center gap-1">
                      <X size={14} /> ما استلمت
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-xs text-gray-400 mb-2">أصدقائك</h3>
        {friends.filter((f) => f.status === "accepted").length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[var(--soft)] flex items-center justify-center mx-auto mb-3">
              <Users size={28} className="text-[var(--accent)]" />
            </div>
            <p className="text-sm text-gray-400">ما عندك أصدقاء لسه</p>
            <p className="text-xs text-gray-300 mt-1">أضف صديق برقم هاتفه</p>
          </div>
        ) : (
          friends.filter((f) => f.status === "accepted").map((f) => (
            <button key={f.friendship_id} onClick={() => setSelectedFriend(f)}
              className="w-full bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--soft)] flex items-center justify-center">
                  <Wallet size={18} className="text-[var(--accent)]" />
                </div>
                <div>
                  <div className="text-sm font-bold">{f.friend_phone}</div>
                  <div className={"text-xs " + (f.balance > 0 ? "text-green-500" : f.balance < 0 ? "text-red-400" : "text-gray-400")}>
                    {f.balance > 0 ? "لك " + f.balance + " جنيه" : f.balance < 0 ? "عليك " + Math.abs(f.balance) + " جنيه" : "مسوّى"}
                  </div>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300" />
            </button>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">أضف صديق</h3>
            <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="رقم هاتف صديقك" required
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
            {err && <div className="text-red-500 text-sm mb-2 text-center">{err}</div>}
            <button onClick={addFriend} disabled={adding}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
              {adding ? "جاري الإضافة..." : "إرسال طلب صداقة"}
            </button>
            <button onClick={() => setShowAdd(false)} className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
          </div>
        </div>
      )}

      {showPin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowPin(false)}>
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--soft)] flex items-center justify-center mx-auto mb-2">
                <Lock size={22} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-base font-bold">تأكيد بالرمز</h3>
              <p className="text-xs text-gray-400 mt-1">اكتب رمز الحماية للتأكيد</p>
            </div>
            <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••" maxLength={8}
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-center text-lg tracking-widest" />
            {pinErr && <div className="text-red-500 text-sm mb-2 text-center">{pinErr}</div>}
            <button onClick={verifyPinAndExecute} disabled={pinVerifying}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
              {pinVerifying ? "جاري التحقق..." : "تأكيد"}
            </button>
            <button onClick={() => { setShowPin(false); setPinInput(""); setPinErr(""); setPendingAction(null); }}
              className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
