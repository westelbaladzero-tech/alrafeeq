"use client";
import { useState, useEffect } from "react";
import { UserPlus, Users, ArrowRight, Check, X, Wallet } from "lucide-react";
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

export default function FriendsView() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const userId = await getResolvedUserId();
    if (!userId) { setLoading(false); return; }
    setUid(userId);
    await loadFriends(userId);
    await loadPendingDebts(userId);
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
    const { error } = await sb.from("friendships")
      .update({ status: accept ? "accepted" : "blocked", updated_at: new Date().toISOString() })
      .eq("id", shipId);
    if (!error) await load();
  }

  async function respondDebt(debtId: string, accept: boolean) {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("debt_requests")
      .update({ status: accept ? "confirmed" : "rejected", confirmed_at: new Date().toISOString() })
      .eq("id", debtId);
    if (!error) await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>;
  }

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

        {pendingDebts.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-400 mb-2">طلبات ديون</h3>
            {pendingDebts.map((d) => (
              <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-bold">
                    {d.you_are === "creditor" ? "لك" : "عليك"} {d.amount} جنيه
                  </div>
                  {d.you_are === "debtor" ? (
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
                  ) : (
                    <span className="text-xs text-gray-400">بانتظار الموافقة</span>
                  )}
                </div>
                {d.description && <div className="text-xs text-gray-400">{d.description}</div>}
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
            <div key={f.friendship_id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)] flex items-center justify-between">
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
            </div>
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
    </div>
  );
}
