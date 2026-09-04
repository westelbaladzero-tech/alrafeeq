"use client";
import { useState, useEffect, useRef } from "react";
import { UserPlus, Users, ArrowRight, ArrowLeft, Check, X, Wallet, HandCoins, Banknote, Lock, MessageCircle, Send } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getResolvedUserId } from "@/lib/client-id";

interface Friend {
  friendship_id: string;
  friend_id: string;
  friend_phone: string;
  status: string;
  initiator: string;
  balance: number;
  relationship: string;
  gam3eya_total: number | null;
  gam3eya_completed: number | null;
  gam3eya_my_turn: number | null;
  gam3eya_amount: number | null;
  gam3eya_start_date: string | null;
  gam3eya_role: string;
  unread_count: number;
}

interface PendingDebt {
  id: string;
  amount: number;
  description: string;
  you_are: "creditor" | "debtor";
  created_at: string;
  is_installment: boolean;
  total_installments: number | null;
  installment_amount: number | null;
  paid_installments: number | null;
  start_date: string | null;
  friend_id: string;
}

interface PendingSettlement {
  id: string;
  amount: number;
  you_are: "sender" | "receiver";
  created_at: string;
  friend_id: string;
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
  const [settleDesc, setSettleDesc] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "debt" | "settlement"; id: string; accept: boolean } | null>(null);
  const [showRelation, setShowRelation] = useState(false);
  const [relationType, setRelationType] = useState("");
  const [relationForShip, setRelationForShip] = useState<string | null>(null);
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState("");
  const [installmentStart, setInstallmentStart] = useState("");
  const [confirmedDebts, setConfirmedDebts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [toast, setToast] = useState("");
  const [showChangeRelation, setShowChangeRelation] = useState(false);
  const [gam3eyaTotal, setGam3eyaTotal] = useState("");
  const [gam3eyaMyTurn, setGam3eyaMyTurn] = useState("");
  const [gam3eyaAmount, setGam3eyaAmount] = useState("");
  const [gam3eyaStart, setGam3eyaStart] = useState("");
  const [gam3eyaRole, setGam3eyaRole] = useState("member");
  const [chatFriend, setChatFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [chatShowDebt, setChatShowDebt] = useState(false);
  const [chatShowSettle, setChatShowSettle] = useState(false);
  const [settleDirection, setSettleDirection] = useState<"me" | "friend">("me");
  const msgEndRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(pollPending, 15000);
    return () => {
      clearInterval(interval);
      if (chatChannelRef.current) {
        chatChannelRef.current.unsubscribe();
      }
    };
  }, []);

  async function load() {
    if (isInitialLoad) setLoading(true);
    const userId = await getResolvedUserId();
    if (!userId) { setLoading(false); setIsInitialLoad(false); return; }
    setUid(userId);
    await loadFriends(userId);
    await loadPendingDebts(userId);
    await loadPendingSettlements(userId);
    setLoading(false);
    setIsInitialLoad(false);
  }

  // تحديث خفيف: يبحث عن طلبات معلّقة جديدة فقط — لا يلمس قائمة الأصدقاء
  async function pollPending() {
    const userId = await getResolvedUserId();
    if (!userId) return;
    await loadPendingDebts(userId);
    await loadPendingSettlements(userId);
  }

  // ─── الشات ───
  async function openChat(friend: Friend) {
    setChatFriend(friend);
    setMessages([]);
    await loadMessages(friend.friendship_id);
    subscribeToMessages(friend.friendship_id);
  }

  function closeChat() {
    if (chatChannelRef.current) {
      chatChannelRef.current.unsubscribe();
      chatChannelRef.current = null;
    }
    setChatFriend(null);
    setMessages([]);
    setMsgInput("");
    // حدّث قائمة الأصدقاء لإزالة مؤشر الرسائل غير المقروءة
    if (uid) loadFriends(uid);
  }

  async function loadMessages(friendshipId: string) {
    const sb = getSupabase() as any;
    if (!sb) return;
    const { data } = await sb.from("messages")
      .select("id, sender_id, content, type, created_at, read_at")
      .eq("friendship_id", friendshipId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data || []);
    // علّم رسائلك كمقروءة
    if (data && data.length > 0 && uid) {
      const unread = data.filter((m: any) => m.sender_id !== uid && !m.read_at);
      for (const m of unread) {
        await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
      }
    }
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function subscribeToMessages(friendshipId: string) {
    const sb = getSupabase() as any;
    if (!sb) return;
    if (chatChannelRef.current) chatChannelRef.current.unsubscribe();
    const channel = sb.channel("chat:" + friendshipId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "friendship_id=eq." + friendshipId },
        (payload: any) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          // علّم كمقروء لو الرسالة لي
          if (payload.new.sender_id !== uid && !payload.new.read_at) {
            sb.from("messages").update({ read_at: new Date().toISOString() }).eq("id", payload.new.id);
          }
          setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      )
      .subscribe();
    chatChannelRef.current = channel;
  }

  async function sendMessage() {
    if (!msgInput.trim() || !chatFriend || !uid) return;
    setMsgSending(true);
    const sb = getSupabase() as any;
    if (!sb) { setMsgSending(false); return; }
    const { error } = await sb.from("messages").insert({
      friendship_id: chatFriend.friendship_id,
      sender_id: uid,
      content: msgInput.trim(),
      type: "text",
    });
    if (!error) setMsgInput("");
    setMsgSending(false);
  }

  // إرسال رسالة نظام في الشات (للديون والتسويات)
  async function sendSystemMessage(friendshipId: string, content: string) {
    const sb = getSupabase() as any;
    if (!sb) return;
    await sb.from("messages").insert({
      friendship_id: friendshipId,
      sender_id: uid,
      content,
      type: "system",
    });
  }

  // إرسال طلب دين من داخل الشات
  async function sendChatDebtRequest() {
    setActionErr("");
    if (!debtAmount || !uid || !chatFriend) return;
    const amt = Number(debtAmount);
    if (isNaN(amt) || amt <= 0) { setActionErr("مبلغ غير صحيح"); return; }
    setSubmitting(true);
    const sb = getSupabase() as any;
    if (!sb) { setSubmitting(false); return; }
    const insertData: any = {
      creditor: uid,
      debtor: chatFriend.friend_id,
      friendship_id: chatFriend.friendship_id,
      amount: amt,
      description: debtDesc || null,
      status: "pending",
      is_installment: isInstallment,
    };
    if (isInstallment) {
      const total = Number(totalInstallments);
      if (!total || total < 2) { setActionErr("عدد الأقساط لازم 2 على الأقل"); setSubmitting(false); return; }
      insertData.total_installments = total;
      insertData.installment_amount = Math.round((amt / total) * 100) / 100;
      insertData.paid_installments = 0;
      if (installmentStart) insertData.start_date = installmentStart;
    }
    const { error } = await sb.from("debt_requests").insert(insertData);
    if (error) { setActionErr("تعذّر إرسال الطلب"); setSubmitting(false); return; }
    // أرسل رسالة نظام في الشات
    await sendSystemMessage(chatFriend.friendship_id,
      (isInstallment ? "طلب دين بالأقساط: " : "طلب دين: ") + amt + " جنيه" + (debtDesc ? " — " + debtDesc : ""));
    setDebtAmount(""); setDebtDesc(""); setIsInstallment(false); setTotalInstallments(""); setInstallmentStart("");
    setChatShowDebt(false);
    await load();
    showToast("تم إرسال طلب الدين");
    setSubmitting(false);
  }

  // إرسال تسوية من داخل الشات
  async function sendChatSettlement() {
    setActionErr("");
    if (!settleAmount || !uid || !chatFriend) return;
    const amt = Number(settleAmount);
    if (isNaN(amt) || amt <= 0) { setActionErr("مبلغ غير صحيح"); return; }
    setSubmitting(true);
    const sb = getSupabase() as any;
    if (!sb) { setSubmitting(false); return; }
    const fromUser = settleDirection === "me" ? uid : chatFriend.friend_id;
    const toUser = settleDirection === "me" ? chatFriend.friend_id : uid;
    const { error } = await sb.from("settlements").insert({
      from_user: fromUser,
      to_user: toUser,
      friendship_id: chatFriend.friendship_id,
      amount: amt,
      description: settleDesc || null,
      status: "pending",
    });
    if (error) { setActionErr("تعذّر إرسال التسوية"); setSubmitting(false); return; }
    await sendSystemMessage(chatFriend.friendship_id,
      (settleDirection === "me" ? "لي عنده: " : "أخذت منه: ") + amt + " جنيه" + (settleDesc ? " — " + settleDesc : ""));
    setSettleAmount(""); setSettleDesc(""); setSettleDirection("me");
    setChatShowSettle(false);
    await load();
    showToast("تم إرسال طلب التسوية");
    setSubmitting(false);
  }

  async function loadFriends(userId: string) {
    const sb = getSupabase() as any;
    if (!sb) return;
    const { data: ships } = await sb
      .from("friendships")
      .select("id, user_a, user_b, status, initiator, relationship_type, gam3eya_total, gam3eya_completed, gam3eya_my_turn, gam3eya_amount, gam3eya_start_date, gam3eya_role")
      .or("user_a.eq." + userId + ",user_b.eq." + userId);
    if (!ships || ships.length === 0) { setFriends([]); return; }
    const friendList: Friend[] = [];
    for (const ship of ships) {
      const friendId = ship.user_a === userId ? ship.user_b : ship.user_a;
      const { data: profile } = await sb.rpc("get_friend_profile", { friend_id: friendId });
      const p = profile && profile.length > 0 ? profile[0] : null;
      const balance = await calculateBalance(sb, userId, friendId);
      // عد الرسائل غير المقروءة
      const { count: unread } = await sb.from("messages")
        .select("id", { count: "exact", head: true })
        .eq("friendship_id", ship.id)
        .neq("sender_id", userId)
        .is("read_at", null);
      friendList.push({
        friendship_id: ship.id, friend_id: friendId,
        friend_phone: p?.phone || "غير معروف",
        status: ship.status, initiator: ship.initiator, balance,
        relationship: ship.relationship_type || "friend",
        gam3eya_total: ship.gam3eya_total || null,
        gam3eya_completed: ship.gam3eya_completed || 0,
        gam3eya_my_turn: ship.gam3eya_my_turn || null,
        gam3eya_amount: ship.gam3eya_amount ? Number(ship.gam3eya_amount) : null,
        gam3eya_start_date: ship.gam3eya_start_date || null,
        gam3eya_role: ship.gam3eya_role || "member",
        unread_count: unread || 0,
      });
    }
    setFriends(friendList);
    // أرسل إجمالي الرسائل غير المقروءة للتبويب
    const totalUnread = friendList.reduce((s, f) => s + f.unread_count, 0);
    window.dispatchEvent(new CustomEvent("friends-unread-update", { detail: totalUnread }));
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
    // owed = ما له عليّ (أنا الدائن)
    // received = ما دفعه لي (from_user=friend) ← يُخصم من owed
    // owe = ما عليّ له (أنا المدين)
    // paid = ما دفعته أنا (from_user=me) ← يُخصم من owe
    return (owed - received) - (owe - paid);
  }

  async function loadPendingDebts(userId: string) {
    const sb = getSupabase() as any;
    if (!sb) return;
    const { data: owed } = await sb.from("debt_requests")
      .select("id, amount, description, creditor, debtor, created_at, is_installment, total_installments, installment_amount, paid_installments, start_date")
      .eq("creditor", userId).eq("status", "pending");
    const { data: owe } = await sb.from("debt_requests")
      .select("id, amount, description, creditor, debtor, created_at, is_installment, total_installments, installment_amount, paid_installments, start_date")
      .eq("debtor", userId).eq("status", "pending");
    const all: PendingDebt[] = [];
    for (const d of [...(owed || []), ...(owe || [])]) {
      all.push({
        id: d.id, amount: Number(d.amount),
        description: d.description || "",
        you_are: d.creditor === userId ? "creditor" : "debtor",
        created_at: d.created_at,
        is_installment: d.is_installment || false,
        total_installments: d.total_installments || null,
        installment_amount: d.installment_amount ? Number(d.installment_amount) : null,
        paid_installments: d.paid_installments || 0,
        start_date: d.start_date || null,
        friend_id: d.creditor === userId ? d.debtor : d.creditor,
      });
    }
    setPendingDebts(all);
  }

  async function loadPendingSettlements(userId: string) {
    const sb = getSupabase() as any;
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
        friend_id: s.from_user === userId ? s.to_user : s.from_user,
      });
    }
    setPendingSetts(all);
  }

  async function loadFriendDetails(me: string, friendId: string) {
    const sb = getSupabase() as any;
    if (!sb) return;

    // الديون المؤكدة (للأقساط)
    const { data: debts } = await sb.from("debt_requests")
      .select("id, amount, description, is_installment, total_installments, installment_amount, paid_installments, start_date, created_at, creditor, debtor, status")
      .or(`and(creditor.eq.${me},debtor.eq.${friendId}),and(creditor.eq.${friendId},debtor.eq.${me})`)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    // التسويات المؤكدة
    const { data: setts } = await sb.from("settlements")
      .select("id, amount, description, from_user, to_user, created_at, status")
      .or(`and(from_user.eq.${me},to_user.eq.${friendId}),and(from_user.eq.${friendId},to_user.eq.${me})`)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    // فلتر المعاملات بيني وبين هذا الصديق فقط
    const friendSetts = (setts || []).filter((s: any) =>
      (s.from_user === me && s.to_user === friendId) ||
      (s.to_user === me && s.from_user === friendId)
    );

    const friendDebts = (debts || []).filter((d: any) =>
      (d.creditor === me && d.debtor === friendId) ||
      (d.debtor === me && d.creditor === friendId)
    );

    setConfirmedDebts(friendDebts);

    // ادمج الديون والتسويات في سجل واحد مرتب
    const allTx: any[] = [];
    for (const d of friendDebts) {
      allTx.push({
        type: "debt",
        id: d.id,
        amount: Number(d.amount),
        description: d.description || "",
        date: d.created_at,
        direction: d.creditor === me ? "owed" : "owe",
        is_installment: d.is_installment,
        total_installments: d.total_installments,
        installment_amount: d.installment_amount ? Number(d.installment_amount) : null,
        paid_installments: d.paid_installments || 0,
      });
    }
    for (const s of friendSetts) {
      allTx.push({
        type: "settlement",
        id: s.id,
        amount: Number(s.amount),
        description: s.description || "",
        date: s.created_at,
        direction: s.from_user === me ? "paid" : "received",
      });
    }
    allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(allTx);
  }

  async function addFriend() {
    setErr("");
    if (!phoneInput || !uid) return;
    setAdding(true);
    const sb = getSupabase() as any;
    if (!sb) { setAdding(false); return; }
    try {
      const { data: target } = await sb.rpc("find_user_by_phone", { search_phone: phoneInput });
      if (!target || target.length === 0) { setErr("الرقم غير مسجل في التطبيق"); setAdding(false); return; }
      const friendData = target[0];
      if (friendData.id === uid) { setErr("ما تقدرش تضيف نفسك"); setAdding(false); return; }
      const { data: existing } = await sb.from("friendships")
        .select("id, status, user_a, user_b")
        .or("user_a.eq." + uid + ",user_b.eq." + uid);
      const already = (existing || []).find((f: any) =>
        (f.user_a === uid && f.user_b === friendData.id) ||
        (f.user_b === uid && f.user_a === friendData.id));
      if (already) {
        setErr(already.status === "accepted" ? "صديقك بالفعل" : "طلب معلّق بالفعل");
        setAdding(false); return;
      }
      const { error } = await sb.from("friendships").insert({
        user_a: uid, user_b: friendData.id, status: "pending", initiator: uid,
      });
      if (error) { setErr("تعذّر إضافة الصديق"); setAdding(false); return; }
      setPhoneInput(""); setShowAdd(false);
      // اسأل المُرسِل عن طبيعة العلاقة
      const { data: newShip } = await sb.from("friendships")
        .select("id").eq("user_a", uid).eq("user_b", friendData.id).maybeSingle();
      if (newShip) {
        setRelationForShip(newShip.id);
        setRelationType("");
        setGam3eyaRole("member");
        setShowRelation(true);
      }
      await load();
      showToast("تم إرسال طلب الصداقة");
    } catch { setErr("خطأ في الاتصال"); }
    setAdding(false);
  }

  async function respondFriendship(shipId: string, accept: boolean) {
    const sb = getSupabase() as any;
    if (!sb) return;
    await sb.from("friendships")
      .update({ status: accept ? "accepted" : "blocked", updated_at: new Date().toISOString() })
      .eq("id", shipId);
    if (accept) {
      setRelationForShip(shipId);
      setRelationType("");
      setGam3eyaRole("member");
      setShowRelation(true);
    }
    await load();
  }

  async function setRelationship() {
    if (!relationType || !relationForShip) return;
    const sb = getSupabase() as any;
    if (!sb) return;
    const updateData: any = { relationship_type: relationType };
    if (relationType === "association") {
      const total = Number(gam3eyaTotal);
      const myTurn = Number(gam3eyaMyTurn);
      const amount = Number(gam3eyaAmount);
      if (!total || total < 2) { showToast("عدد الأدوار لازم 2 على الأقل"); return; }
      if (gam3eyaRole === "member" && (!myTurn || myTurn < 1 || myTurn > total)) { showToast("دورك يجب أن يكون بين 1 و " + total); return; }
      if (!amount || amount <= 0) { showToast("المبلغ الشهري غير صحيح"); return; }
      updateData.gam3eya_total = total;
      updateData.gam3eya_role = gam3eyaRole;
      if (gam3eyaRole === "member") {
        updateData.gam3eya_my_turn = myTurn;
      } else {
        updateData.gam3eya_my_turn = null;
      }
      updateData.gam3eya_amount = amount;
      updateData.gam3eya_completed = 0;
      if (gam3eyaStart) updateData.gam3eya_start_date = gam3eyaStart;
    }
    await sb.from("friendships").update(updateData).eq("id", relationForShip);
    setShowRelation(false);
    setRelationForShip(null);
    setRelationType("");
    setGam3eyaTotal(""); setGam3eyaMyTurn(""); setGam3eyaAmount(""); setGam3eyaStart(""); setGam3eyaRole("member");
    await load();
  }

  function getRelationLabel(type: string): string {
    const labels: Record<string, string> = {
      friend: "صديق",
      employer: "صاحب عمل",
      colleague: "أعمل مع",
      partner: "شريك",
      client: "عميل",
      association: "جمعية",
    };
    return labels[type] || "صديق";
  }

  async function respondDebt(debtId: string, accept: boolean) {
    if (accept) {
      // الموافقة تحتاج PIN
      setPendingAction({ type: "debt", id: debtId, accept: true });
      setPinInput(""); setPinErr(""); setShowPin(true);
    } else {
      // الرفض مباشر بدون PIN
      const sb = getSupabase() as any;
      if (!sb) return;
      await sb.from("debt_requests")
        .update({ status: "rejected", confirmed_at: new Date().toISOString() })
        .eq("id", debtId);
      await load();
      showToast("تم رفض الدين");
    }
  }

  async function respondSettlement(settId: string, accept: boolean) {
    if (accept) {
      // الموافقة تحتاج PIN
      setPendingAction({ type: "settlement", id: settId, accept: true });
      setPinInput(""); setPinErr(""); setShowPin(true);
    } else {
      // الرفض مباشر بدون PIN
      const sb = getSupabase() as any;
      if (!sb) return;
      await sb.from("settlements")
        .update({ status: "rejected", confirmed_at: new Date().toISOString() })
        .eq("id", settId);
      await load();
      showToast("تم رفض التسوية");
    }
  }

  async function verifyPinAndExecute() {
    setPinErr("");
    if (!pinInput) { setPinErr("اكتب الرمز"); return; }
    if (!uid) { setPinErr("انتهت الجلسة — سجّل دخولك"); setPinVerifying(false); return; }
    setPinVerifying(true);

    const sb = getSupabase() as any;
    if (!sb) { setPinVerifying(false); return; }

    // حاول getSession أولاً، لو فشل استخدم uid كـ fallback
    let accessToken: string | null = null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) accessToken = session.access_token;
    } catch {}

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput, accessToken, userId: uid }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setPinErr(data.error || "الرمز خاطئ");
        setPinVerifying(false);
        return;
      }

      // PIN صحيح ← نفّذ العملية
      if (pendingAction) {
        const sb2 = getSupabase() as any;
        if (sb2) {
          const table = pendingAction.type === "debt" ? "debt_requests" : "settlements";
          const status = pendingAction.accept ? "confirmed" : "rejected";
          await sb2.from(table)
            .update({ status, confirmed_at: new Date().toISOString() })
            .eq("id", pendingAction.id);

          // لو تأكيد تسوية ← حدّث paid_installments لو الدين أقساط
          if (pendingAction.type === "settlement" && pendingAction.accept) {
            const { data: sett } = await sb2.from("settlements")
              .select("from_user, to_user, amount")
              .eq("id", pendingAction.id).maybeSingle();
            if (sett) {
              // من يدفع لمن: from_user (المدين) → to_user (الدائن)
              // ابحث عن دين أقساط حيث الدائن = to_user والمدين = from_user
              const { data: debts } = await sb2.from("debt_requests")
                .select("id, paid_installments, total_installments, installment_amount")
                .eq("creditor", sett.to_user)
                .eq("debtor", sett.from_user)
                .eq("is_installment", true)
                .eq("status", "confirmed")
                .order("created_at", { ascending: false });
              if (debts && debts.length > 0) {
                // لو مبلغ التسوية = قسط واحد ← زيد بنسبة قسط واحد
                const debt = debts[0];
                const total = debt.total_installments || 0;
                const currentPaid = debt.paid_installments || 0;
                if (currentPaid < total) {
                  // احسب عدد الأقساط اللي بيسددها المبلغ
                  const instAmt = Number(debt.installment_amount) || 0;
                  let inc = 1;
                  if (instAmt > 0) {
                    inc = Math.min(Math.round(Number(sett.amount) / instAmt), total - currentPaid);
                    if (inc < 1) inc = 1;
                  }
                  await sb2.from("debt_requests")
                    .update({ paid_installments: currentPaid + inc })
                    .eq("id", debt.id);
                }
              }
            }
          }
        }
      }

      setShowPin(false);
      const action = pendingAction;
      setPinInput("");
      setPendingAction(null);
      await load();
      showToast(action?.accept ? (action.type === "debt" ? "تم تأكيد الدين" : "تم تأكيد التسوية") : "تم الرفض");
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
    const sb = getSupabase() as any;
    if (!sb) { setSubmitting(false); return; }
    
    const insertData: any = {
      creditor: uid,
      debtor: selectedFriend.friend_id,
      friendship_id: selectedFriend.friendship_id,
      amount: amt,
      description: debtDesc || null,
      status: "pending",
      is_installment: isInstallment,
    };
    
    if (isInstallment) {
      const total = Number(totalInstallments);
      if (!total || total < 2) { setActionErr("عدد الأقساط لازم 2 على الأقل"); setSubmitting(false); return; }
      insertData.total_installments = total;
      insertData.installment_amount = Math.round((amt / total) * 100) / 100;
      insertData.paid_installments = 0;
      if (installmentStart) insertData.start_date = installmentStart;
    }
    
    const { error } = await sb.from("debt_requests").insert(insertData);
    if (error) { setActionErr("تعذّر إرسال الطلب"); setSubmitting(false); return; }
    setDebtAmount(""); setDebtDesc(""); setIsInstallment(false); setTotalInstallments(""); setInstallmentStart("");
    setShowDebt(false); await load();
    showToast("تم إرسال طلب الدين");
    setSubmitting(false);
  }

  async function sendSettlement() {
    setActionErr("");
    if (!settleAmount || !uid || !selectedFriend) return;
    const amt = Number(settleAmount);
    if (isNaN(amt) || amt <= 0) { setActionErr("مبلغ غير صحيح"); return; }
    setSubmitting(true);
    const sb = getSupabase() as any;
    if (!sb) { setSubmitting(false); return; }
    const fromUser = settleDirection === "me" ? uid : selectedFriend.friend_id;
    const toUser = settleDirection === "me" ? selectedFriend.friend_id : uid;
    const { error } = await sb.from("settlements").insert({
      from_user: fromUser,
      to_user: toUser,
      friendship_id: selectedFriend.friendship_id,
      amount: amt,
      description: settleDesc || null,
      status: "pending",
    });
    if (error) { setActionErr("تعذّر إرسال التسوية"); setSubmitting(false); return; }
    setSettleAmount(""); setSettleDesc(""); setSettleDirection("me"); setShowSettle(false); await load();
    showToast("تم إرسال طلب التسوية");
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>;
  }

  // ─── صفحة الشات ───
  if (chatFriend) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg)]">
        <div className="p-3 bg-white border-b border-[var(--soft)] flex items-center gap-2">
          <button onClick={closeChat} className="text-gray-400">
            <ArrowRight size={20} />
          </button>
          <div className="w-9 h-9 rounded-full bg-[var(--soft)] flex items-center justify-center">
            <MessageCircle size={18} className="text-[var(--accent)]" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">{chatFriend.friend_phone}</div>
            <div className="text-[10px] text-gray-400">{getRelationLabel(chatFriend.relationship)}</div>
          </div>
          <div className={"text-xs " + (chatFriend.balance > 0 ? "text-green-500" : chatFriend.balance < 0 ? "text-red-400" : "text-gray-300")}>
            {chatFriend.balance !== 0 ? (chatFriend.balance > 0 ? "لك " : "عليك ") + Math.abs(chatFriend.balance) : ""}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-center text-gray-300 text-sm mt-8">لا توجد رسائل بعد</div>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === uid;
            if (m.type === "system") {
              return (
                <div key={m.id} className="text-center my-2">
                  <span className="inline-block text-[11px] text-[var(--accent-dark)] bg-green-50 border border-green-100 rounded-xl px-3 py-1.5 font-bold">
                    {m.content}
                  </span>
                  <div className="text-[9px] text-gray-300 mt-0.5">
                    {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div className={"max-w-[75%] rounded-2xl px-3 py-2 " + (mine ? "bg-[var(--accent)] text-white" : "bg-white text-gray-800 border border-[var(--soft)]")}>
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  <div className={"text-[9px] mt-0.5 " + (mine ? "text-white/60" : "text-gray-300")}>
                    {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    {mine && (m.read_at ? " ✓✓" : " ✓")}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-[var(--soft)] flex items-center gap-2">
          <button onClick={() => setChatShowDebt(true)}
            className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0"
            title="ليّ عنده">
            <HandCoins size={18} className="text-[var(--accent)]" />
          </button>
          <button onClick={() => setChatShowSettle(true)}
            className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0"
            title="تسوية">
            <Banknote size={18} className="text-[var(--accent)]" />
          </button>
          <input
            type="text"
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm"
          />
          <button onClick={sendMessage} disabled={msgSending || !msgInput.trim()}
            className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-40 shrink-0">
            <Send size={18} />
          </button>
        </div>

        {/* مودال طلب دين داخل الشات */}
        {chatShowDebt && chatFriend && (
          <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setChatShowDebt(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-1">ليّ عنده</h3>
              <p className="text-xs text-gray-400 mb-4">عندك فلوس عند {chatFriend.friend_phone}</p>
              <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)}
                placeholder="المبلغ الإجمالي بالجنيه" required
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
              <input type="text" value={debtDesc} onChange={(e) => setDebtDesc(e.target.value)}
                placeholder="وصف (اختياري)"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
              <div className="flex gap-2 mb-3">
                <button onClick={() => setIsInstallment(false)}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (!isInstallment ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  دفعة واحدة
                </button>
                <button onClick={() => setIsInstallment(true)}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (isInstallment ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  أقساط
                </button>
              </div>
              {isInstallment && (
                <div className="space-y-2 mb-3">
                  <input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)}
                    placeholder="عدد الأقساط (مثلاً: 12)" min={2}
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  <input type="date" value={installmentStart} onChange={(e) => setInstallmentStart(e.target.value)}
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  {debtAmount && totalInstallments && Number(totalInstallments) > 0 && (
                    <div className="bg-green-50 rounded-xl p-2 text-xs text-green-600 text-center">
                      كل قسط: {Math.round((Number(debtAmount) / Number(totalInstallments)) * 100) / 100} جنيه × {totalInstallments} شهر
                    </div>
                  )}
                </div>
              )}
              {actionErr && <div className="text-red-500 text-sm mb-2 text-center">{actionErr}</div>}
              <button onClick={sendChatDebtRequest} disabled={submitting}
                className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
                {submitting ? "جاري الإرسال..." : "إرسال طلب دين"}
              </button>
              <button onClick={() => setChatShowDebt(false)} className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
            </div>
          </div>
        )}

        {/* مودال تسوية داخل الشات */}
        {chatShowSettle && chatFriend && (
          <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setChatShowSettle(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-1">تسوية</h3>
              <p className="text-xs text-gray-400 mb-4">{chatFriend.friend_phone}</p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setSettleDirection("me")}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "me" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  لي عنده
                </button>
                <button onClick={() => setSettleDirection("friend")}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "friend" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  أخذت منه
                </button>
              </div>
              <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="المبلغ بالجنيه" required
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
              <input type="text" value={settleDesc} onChange={(e) => setSettleDesc(e.target.value)}
                placeholder="وصف الدفعة (اختياري)"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
              {actionErr && <div className="text-red-500 text-sm mb-2 text-center">{actionErr}</div>}
              <button onClick={sendChatSettlement} disabled={submitting}
                className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
                {submitting ? "جاري الإرسال..." : "إرسال طلب تأكيد"}
              </button>
              <button onClick={() => setChatShowSettle(false)} className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
            </div>
          </div>
        )}
      </div>
    );
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
              <div className="flex-1">
                <div className="text-base font-bold">{selectedFriend.friend_phone}</div>
                <button onClick={() => {
                  setRelationForShip(selectedFriend.friendship_id);
                  setRelationType(selectedFriend.relationship);
                  setGam3eyaRole(selectedFriend.gam3eya_role || "member");
                  setGam3eyaTotal(selectedFriend.gam3eya_total ? String(selectedFriend.gam3eya_total) : "");
                  setGam3eyaMyTurn(selectedFriend.gam3eya_my_turn ? String(selectedFriend.gam3eya_my_turn) : "");
                  setGam3eyaAmount(selectedFriend.gam3eya_amount ? String(selectedFriend.gam3eya_amount) : "");
                  setGam3eyaStart(selectedFriend.gam3eya_start_date ? selectedFriend.gam3eya_start_date.split("T")[0] : "");
                  setShowChangeRelation(true);
                }}
                  className="text-xs text-gray-400 hover:text-[var(--accent)] flex items-center gap-1 mb-0.5">
                  {getRelationLabel(selectedFriend.relationship)}
                  <span className="text-[9px]">✎</span>
                </button>
                <div className={"text-sm " + (selectedFriend.balance > 0 ? "text-green-500" : selectedFriend.balance < 0 ? "text-red-400" : "text-gray-400")}>
                  {selectedFriend.balance > 0 ? "لك " + selectedFriend.balance + " جنيه" : selectedFriend.balance < 0 ? "عليك " + Math.abs(selectedFriend.balance) + " جنيه" : "الحساب مسوّى"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <button onClick={() => setShowDebt(true)}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)]">
              <HandCoins size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">ليّ عنده</span>
            </button>
            <button onClick={() => setShowSettle(true)}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)]">
              <Banknote size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">تسوية</span>
            </button>
            <button onClick={() => openChat(selectedFriend)}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)]">
              <MessageCircle size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">دردشة</span>
            </button>
          </div>

          {/* طلبات معلّقة لهذا الصديق */}
          {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "debtor").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">طلبات ديون عليك</h3>
              {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "debtor").map((d) => (
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
                  {d.is_installment && d.total_installments && (
                    <div className="text-[10px] text-green-600 mt-1 bg-green-50 rounded-lg px-2 py-1">
                      أقساط: {d.total_installments} × {d.installment_amount} جنيه
                      {d.start_date && " • يبدأ من " + new Date(d.start_date).toLocaleDateString("ar-EG")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.you_are === "receiver").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">تأكيد استلام</h3>
              {pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.you_are === "receiver").map((s) => (
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

          {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "creditor").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">طلبات دين أرسلتها</h3>
              {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "creditor").map((d) => (
                <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-bold">لك {d.amount} جنيه</div>
                    <span className="text-xs text-gray-400">بانتظار الموافقة</span>
                  </div>
                  {d.description && <div className="text-xs text-gray-400 mt-1">{d.description}</div>}
                  {d.is_installment && d.total_installments && (
                    <div className="text-[10px] text-green-600 mt-1 bg-green-50 rounded-lg px-2 py-1">
                      أقساط: {d.total_installments} × {d.installment_amount} جنيه
                      {d.start_date && " • يبدأ من " + new Date(d.start_date).toLocaleDateString("ar-EG")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.you_are === "sender").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">تسويات أرسلتها</h3>
              {pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.you_are === "sender").map((s) => (
                <div key={s.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-bold">دفعت {s.amount} جنيه</div>
                    <span className="text-xs text-gray-400">بانتظار التأكيد</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* تقدم الأقساط */}
          {confirmedDebts.filter((d) => d.is_installment).length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">تقدم الأقساط</h3>
              {confirmedDebts.filter((d) => d.is_installment).map((d) => {
                const paid = d.paid_installments || 0;
                const total = d.total_installments || 0;
                const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                return (
                  <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-sm font-bold">{Number(d.amount)} جنيه</div>
                      <div className="text-xs text-gray-400">{paid}/{total} قسط</div>
                    </div>
                    {d.description && <div className="text-xs text-gray-400 mb-1">{d.description}</div>}
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                      <div className="bg-[var(--accent)] rounded-full h-2 transition-all" style={{ width: pct + "%" }} />
                    </div>
                    <div className="text-[10px] text-gray-400">
                      كل قسط: {d.installment_amount ? Number(d.installment_amount) : 0} جنيه
                      {d.start_date && " • بدأ: " + new Date(d.start_date).toLocaleDateString("ar-EG")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* تقدم الجمعية */}
          {selectedFriend.relationship === "association" && selectedFriend.gam3eya_total && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">جمعية {selectedFriend.gam3eya_role === "manager" ? "🏢 (مدير)" : "👤 (فرد)"}</h3>
              <div className="bg-white rounded-2xl p-3 border border-[var(--soft)]">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-bold">
                    {selectedFriend.gam3eya_role === "manager" ? "أنت المدير" : "دورك: " + selectedFriend.gam3eya_my_turn}
                  </div>
                  <div className="text-xs text-gray-400">
                    {selectedFriend.gam3eya_role === "manager"
                      ? "Pot: " + (selectedFriend.gam3eya_total * (selectedFriend.gam3eya_amount || 0)) + " جنيه"
                      : ((selectedFriend.gam3eya_completed || 0) >= (selectedFriend.gam3eya_my_turn || 0) ? "استلمت دورك ✅" : "بانتظار دورك")}
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="bg-[var(--accent)] rounded-full h-2 transition-all"
                    style={{ width: Math.round(((selectedFriend.gam3eya_completed || 0) / selectedFriend.gam3eya_total) * 100) + "%" }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>المنقضي: {selectedFriend.gam3eya_completed || 0}/{selectedFriend.gam3eya_total}</span>
                  <span>المتبقي: {selectedFriend.gam3eya_total - (selectedFriend.gam3eya_completed || 0)}</span>
                </div>
                {selectedFriend.gam3eya_amount && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    شهرياً: {selectedFriend.gam3eya_amount} جنيه
                    {selectedFriend.gam3eya_start_date && " • بدأت: " + new Date(selectedFriend.gam3eya_start_date).toLocaleDateString("ar-EG")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* سجل المعاملات */}
          {transactions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">سجل المعاملات</h3>
              {transactions.slice(0, 20).map((t) => (
                <div key={t.type + t.id} className="bg-white rounded-xl p-2.5 mb-1.5 border border-[var(--soft)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={"w-8 h-8 rounded-lg flex items-center justify-center " + (t.direction === "owed" || t.direction === "received" ? "bg-green-50" : "bg-red-50")}>
                      {t.direction === "owed" ? <HandCoins size={14} className="text-green-500" /> :
                       t.direction === "owe" ? <HandCoins size={14} className="text-red-400" /> :
                       t.direction === "paid" ? <Banknote size={14} className="text-red-400" /> :
                       <Banknote size={14} className="text-green-500" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">
                        {t.direction === "owed" ? "لك" : t.direction === "owe" ? "عليك" : t.direction === "paid" ? "دفعت" : "استلمت"} {t.amount} جنيه
                      </div>
                      {t.description && <div className="text-[10px] text-gray-400">{t.description}</div>}
                      {t.is_installment && t.total_installments && (
                        <div className="text-[10px] text-green-600">{t.paid_installments}/{t.total_installments} قسط</div>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-300">{new Date(t.date).toLocaleDateString("ar-EG")}</div>
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
                placeholder="المبلغ الإجمالي بالجنيه" required
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
              <input type="text" value={debtDesc} onChange={(e) => setDebtDesc(e.target.value)}
                placeholder="وصف (اختياري)"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />

              <div className="flex gap-2 mb-3">
                <button onClick={() => setIsInstallment(false)}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (!isInstallment ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  دفعة واحدة
                </button>
                <button onClick={() => setIsInstallment(true)}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (isInstallment ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  أقساط
                </button>
              </div>

              {isInstallment && (
                <div className="space-y-2 mb-3">
                  <input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)}
                    placeholder="عدد الأقساط (مثلاً: 12)" min={2}
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  <input type="date" value={installmentStart} onChange={(e) => setInstallmentStart(e.target.value)}
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  {debtAmount && totalInstallments && Number(totalInstallments) > 0 && (
                    <div className="bg-green-50 rounded-xl p-2 text-xs text-green-600 text-center">
                      كل قسط: {Math.round((Number(debtAmount) / Number(totalInstallments)) * 100) / 100} جنيه × {totalInstallments} شهر
                    </div>
                  )}
                </div>
              )}

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
              <h3 className="text-lg font-bold mb-1">تسوية</h3>
              <p className="text-xs text-gray-400 mb-4">{selectedFriend.friend_phone}</p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setSettleDirection("me")}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "me" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  لي عنده
                </button>
                <button onClick={() => setSettleDirection("friend")}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "friend" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  أخذت منه
                </button>
              </div>
              <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="المبلغ بالجنيه" required
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
              <input type="text" value={settleDesc} onChange={(e) => setSettleDesc(e.target.value)}
                placeholder="وصف الدفعة (اختياري)"
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

        {/* مودال PIN — مطلوب لزر التأكيد */}
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

        {/* مودال تغيير العلاقة — مطلوب في صفحة الصديق */}
        {showChangeRelation && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowChangeRelation(false)}>
            <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-center mb-1">غيّر نوع العلاقة</h3>
              <p className="text-xs text-gray-400 text-center mb-4">النوع الحالي: {getRelationLabel(relationType)}</p>
              <div className="space-y-2">
                {[
                  { value: "friend", label: "صديق", emoji: "🤝" },
                  { value: "employer", label: "صاحب عمل", emoji: "💼" },
                  { value: "colleague", label: "أعمل مع", emoji: "👥" },
                  { value: "partner", label: "شريك", emoji: "🤝" },
                  { value: "client", label: "عميل", emoji: "📋" },
                  { value: "association", label: "جمعية", emoji: "🔄" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setRelationType(opt.value)}
                    className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (relationType === opt.value ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-sm font-bold">{opt.label}</span>
                    {relationType === opt.value && <Check size={16} className="text-[var(--accent)] mr-auto" />}
                  </button>
                ))}
              </div>
              {relationType === "association" && (
                <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button onClick={() => setGam3eyaRole("member")}
                      className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (gam3eyaRole === "member" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                      فرد 👤
                    </button>
                    <button onClick={() => setGam3eyaRole("manager")}
                      className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (gam3eyaRole === "manager" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                      مدير 💼
                    </button>
                  </div>
                  <input type="number" value={gam3eyaTotal} onChange={(e) => setGam3eyaTotal(e.target.value)}
                    placeholder="عدد الأدوار الكلية" min={2}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  {gam3eyaRole === "member" && (
                    <input type="number" value={gam3eyaMyTurn} onChange={(e) => setGam3eyaMyTurn(e.target.value)}
                      placeholder="دورك (رقم الدورة)" min={1}
                      className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  )}
                  <input type="number" value={gam3eyaAmount} onChange={(e) => setGam3eyaAmount(e.target.value)}
                    placeholder="المبلغ الشهري" min={1}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                  <input type="date" value={gam3eyaStart} onChange={(e) => setGam3eyaStart(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                </div>
              )}
              <button onClick={async () => {
                if (relationType && relationForShip) {
                  const sb = getSupabase() as any;
                  if (sb) {
                    const updateData: any = { relationship_type: relationType };
                    if (relationType === "association") {
                      if (gam3eyaTotal) updateData.gam3eya_total = Number(gam3eyaTotal);
                      if (gam3eyaRole) updateData.gam3eya_role = gam3eyaRole;
                      if (gam3eyaRole === "member" && gam3eyaMyTurn) updateData.gam3eya_my_turn = Number(gam3eyaMyTurn);
                      if (gam3eyaAmount) updateData.gam3eya_amount = Number(gam3eyaAmount);
                      if (gam3eyaStart) updateData.gam3eya_start_date = gam3eyaStart;
                    }
                    await sb.from("friendships").update(updateData).eq("id", relationForShip);
                    showToast("تم تحديث العلاقة");
                    setShowChangeRelation(false);
                    setRelationForShip(null);
                    setGam3eyaTotal(""); setGam3eyaMyTurn(""); setGam3eyaAmount(""); setGam3eyaStart(""); setGam3eyaRole("member");
                    if (selectedFriend) {
                      const sf: Friend = selectedFriend;
                      const updated: Friend = { ...sf, relationship: relationType, gam3eya_role: relationType === "association" ? gam3eyaRole : sf.gam3eya_role };
                      setSelectedFriend(updated);
                    }
                    await load();
                  }
                }
              }} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold text-sm mt-4">
                حفظ
              </button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--accent-dark)] text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in">
            {toast}
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--accent-dark)]">الأصدقاء</h2>
            {friends.reduce((s, f) => s + f.unread_count, 0) > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5">
                {friends.reduce((s, f) => s + f.unread_count, 0)}
              </span>
            )}
          </div>
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

        {/* ملخص الطلبات المعلّقة */}
        {(() => {
          const pendingCount = pendingDebts.filter((d) => d.you_are === "debtor").length
            + pendingSetts.filter((s) => s.you_are === "receiver").length;
          if (pendingCount === 0) return null;
          return (
            <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-center">
              <span className="text-xs text-amber-600 font-bold">
                لديك {pendingCount} طلب معلّق — افتح صفحة الصديق للتأكيد
              </span>
            </div>
          );
        })()}

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
            <div key={f.friendship_id} className="w-full bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)] flex items-center justify-between">
              <button onClick={() => {
                setSelectedFriend(f);
                getResolvedUserId().then((myId) => { if (myId) loadFriendDetails(myId, f.friend_id); });
              }} className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[var(--soft)] flex items-center justify-center">
                    <Wallet size={18} className="text-[var(--accent)]" />
                  </div>
                  {f.unread_count > 0 && (
                    <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                      {f.unread_count}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{f.friend_phone}</div>
                  <div className="text-[10px] text-gray-300">{getRelationLabel(f.relationship)}</div>
                  <div className={"text-xs " + (f.balance > 0 ? "text-green-500" : f.balance < 0 ? "text-red-400" : "text-gray-400")}>
                    {f.balance > 0 ? "لك " + f.balance + " جنيه" : f.balance < 0 ? "عليك " + Math.abs(f.balance) + " جنيه" : "مسوّى"}
                  </div>
                </div>
              </button>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); openChat(f); }}
                  className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="text-[var(--accent)]" />
                </button>
                {(() => {
                  const friendPending = pendingDebts.filter((d) => d.friend_id === f.friend_id && d.you_are === "debtor").length
                    + pendingSetts.filter((s) => s.friend_id === f.friend_id && s.you_are === "receiver").length;
                  if (friendPending > 0) {
                    return (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                        {friendPending}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
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

      {showRelation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRelation(false)}>
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-center mb-1">ما طبيعة علاقتك؟</h3>
            <p className="text-xs text-gray-400 text-center mb-4">ده يساعدنا نفهم حساباتك أحسن</p>
            <div className="space-y-2">
              {[
                { value: "friend", label: "صديق", emoji: "🤝" },
                { value: "employer", label: "صاحب عمل", emoji: "💼" },
                { value: "colleague", label: "أعمل مع", emoji: "👥" },
                { value: "partner", label: "شريك", emoji: "🤝" },
                { value: "client", label: "عميل", emoji: "📋" },
                { value: "association", label: "جمعية", emoji: "🔄" },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setRelationType(opt.value)}
                  className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (relationType === opt.value ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-sm font-bold">{opt.label}</span>
                  {relationType === opt.value && <Check size={16} className="text-[var(--accent)] mr-auto" />}
                </button>
              ))}
            </div>

            {relationType === "association" && (
              <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                <div className="flex gap-2">
                  <button onClick={() => setGam3eyaRole("member")}
                    className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (gam3eyaRole === "member" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                    فرد 👤
                  </button>
                  <button onClick={() => setGam3eyaRole("manager")}
                    className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (gam3eyaRole === "manager" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                    مدير 💼
                  </button>
                </div>
                <input type="number" value={gam3eyaTotal} onChange={(e) => setGam3eyaTotal(e.target.value)}
                  placeholder="عدد الأدوار الكلية" min={2}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                {gam3eyaRole === "member" && (
                  <input type="number" value={gam3eyaMyTurn} onChange={(e) => setGam3eyaMyTurn(e.target.value)}
                    placeholder="دورك (رقم الدورة)" min={1}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                )}
                <input type="number" value={gam3eyaAmount} onChange={(e) => setGam3eyaAmount(e.target.value)}
                  placeholder="المبلغ الشهري" min={1}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                <input type="date" value={gam3eyaStart} onChange={(e) => setGam3eyaStart(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                {gam3eyaTotal && gam3eyaAmount && Number(gam3eyaTotal) > 0 && Number(gam3eyaAmount) > 0 && (
                  <div className="bg-green-50 rounded-lg p-2 text-xs text-green-600 text-center">
                    إجمالي الجمعية: {Number(gam3eyaTotal) * Number(gam3eyaAmount)} جنيه
                    {gam3eyaRole === "member" && gam3eyaMyTurn && Number(gam3eyaMyTurn) > 0 && " • دورك: " + gam3eyaMyTurn}
                    {gam3eyaRole === "manager" && " • أنت المدير"}
                  </div>
                )}
              </div>
            )}

            <button onClick={setRelationship} disabled={!relationType}
              className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm mt-4">
              تأكيد
            </button>
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

      {/* مودال تغيير العلاقة */}
      {showChangeRelation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowChangeRelation(false)}>
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-center mb-1">غيّر نوع العلاقة</h3>
            <p className="text-xs text-gray-400 text-center mb-4">النوع الحالي: {getRelationLabel(relationType)}</p>
            <div className="space-y-2">
              {[
                { value: "friend", label: "صديق", emoji: "🤝" },
                { value: "employer", label: "صاحب عمل", emoji: "💼" },
                { value: "colleague", label: "أعمل مع", emoji: "👥" },
                { value: "partner", label: "شريك", emoji: "🤝" },
                { value: "client", label: "عميل", emoji: "📋" },
                { value: "association", label: "جمعية", emoji: "🔄" },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setRelationType(opt.value)}
                  className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (relationType === opt.value ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-sm font-bold">{opt.label}</span>
                  {relationType === opt.value && <Check size={16} className="text-[var(--accent)] mr-auto" />}
                </button>
              ))}
            </div>

            {relationType === "association" && (
              <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                <div className="flex gap-2">
                  <button onClick={() => setGam3eyaRole("member")}
                    className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (gam3eyaRole === "member" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                    فرد 👤
                  </button>
                  <button onClick={() => setGam3eyaRole("manager")}
                    className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (gam3eyaRole === "manager" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                    مدير 💼
                  </button>
                </div>
                <input type="number" value={gam3eyaTotal} onChange={(e) => setGam3eyaTotal(e.target.value)}
                  placeholder="عدد الأدوار الكلية" min={2}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                {gam3eyaRole === "member" && (
                  <input type="number" value={gam3eyaMyTurn} onChange={(e) => setGam3eyaMyTurn(e.target.value)}
                    placeholder="دورك (رقم الدورة)" min={1}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                )}
                <input type="number" value={gam3eyaAmount} onChange={(e) => setGam3eyaAmount(e.target.value)}
                  placeholder="المبلغ الشهري" min={1}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                <input type="date" value={gam3eyaStart} onChange={(e) => setGam3eyaStart(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
              </div>
            )}

            <button onClick={async () => {
              if (relationType && relationForShip) {
                const sb = getSupabase() as any;
                if (sb) {
                  const updateData: any = { relationship_type: relationType };
                  if (relationType === "association") {
                    if (gam3eyaTotal) updateData.gam3eya_total = Number(gam3eyaTotal);
                    if (gam3eyaRole) updateData.gam3eya_role = gam3eyaRole;
                    if (gam3eyaRole === "member" && gam3eyaMyTurn) updateData.gam3eya_my_turn = Number(gam3eyaMyTurn);
                    if (gam3eyaAmount) updateData.gam3eya_amount = Number(gam3eyaAmount);
                    if (gam3eyaStart) updateData.gam3eya_start_date = gam3eyaStart;
                  }
                  await sb.from("friendships").update(updateData).eq("id", relationForShip);
                  showToast("تم تحديث العلاقة");
                  setShowChangeRelation(false);
                  setRelationForShip(null);
                  setGam3eyaTotal(""); setGam3eyaMyTurn(""); setGam3eyaAmount(""); setGam3eyaStart(""); setGam3eyaRole("member");
                  if (selectedFriend) {
                    const sf: Friend = selectedFriend;
                    const updated: Friend = { ...sf, relationship: relationType, gam3eya_role: relationType === "association" ? gam3eyaRole : sf.gam3eya_role };
                    setSelectedFriend(updated);
                  }
                  await load();
                }
              }
            }} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold text-sm mt-4">
              حفظ
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--accent-dark)] text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
