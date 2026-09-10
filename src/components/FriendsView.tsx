"use client";
import { useState, useEffect, useRef } from "react";
import { Key as KeyIcon, UserPlus, Users, ArrowRight, ArrowLeft, Check, X, Wallet, HandCoins, Banknote, Lock, MessageCircle, Send, Paperclip, Image as ImageIcon, FileText, Download, Volume2, Mic, MicOff, Loader2, ScanText, CreditCard, CalendarClock, RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import PaymentMethodsModal from "./PaymentMethodsModal";
import QRCode, { downloadQR } from "./QRCode";
import { getResolvedUserId } from "@/lib/client-id";
import { generateKeyPair, getPrivateKey, encryptMessage, decryptMessage, importPublicKey, encryptPrivateKeyForBackup, decryptPrivateKeyFromBackup } from "@/lib/e2e-crypto";
import { unlockPrivateKey, hasEncryptedKey, getActivePrivateKey, getUnlockStatus } from "@/lib/e2e-key-manager";
import { getUserIdSync } from "@/lib/client-id";
import { getAuthHeaders } from "@/lib/auth-client";

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
  status?: string;
}

interface PendingSettlement {
  id: string;
  amount: number;
  you_are: "sender" | "receiver";
  created_at: string;
  friend_id: string;
  status?: string;
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
  const [settleCategory, setSettleCategory] = useState<"debt" | "installment" | "gam3eya">("debt");
  const [settleItemId, setSettleItemId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "debt" | "settlement"; id: string; accept: boolean } | null>(null);
  const [showRelation, setShowRelation] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [pendingRelReqs, setPendingRelReqs] = useState<any[]>([]);
  const [showRelReq, setShowRelReq] = useState(false);
  const [relReqRole, setRelReqRole] = useState("");
  const [relReqReason, setRelReqReason] = useState("");
  const [relReqShip, setRelReqShip] = useState<string | null>(null);
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
  const [chatShowP2P, setChatShowP2P] = useState(false);
  const [chatShowUnified, setChatShowUnified] = useState(false);
  const [unifiedCat, setUnifiedCat] = useState<"debt" | "installment" | "gam3eya">("debt");
  const [unifiedMethod, setUnifiedMethod] = useState<"cash" | "p2p">("cash");
  const [p2pStep, setP2pStep] = useState<"category" | "items" | "select" | "qr" | "amount" | "done">("category");
  const [p2pCategory, setP2pCategory] = useState<any>(null);
  const [p2pItems, setP2pItems] = useState<Array<Record<string, any>>>([]);
  const [p2pSelectedItem, setP2pSelectedItem] = useState<any>(null);
  const [p2pFriendMethods, setP2pFriendMethods] = useState<any[]>([]);
  const [p2pSelectedMethod, setP2pSelectedMethod] = useState<any>(null);
  const [p2pAmount, setP2pAmount] = useState("");
  const [p2pLoading, setP2pLoading] = useState(false);
  const [p2pResult, setP2pResult] = useState<any>(null);
  const [p2pReceiptUploading, setP2pReceiptUploading] = useState(false);
  const [receiptInputRef] = useState<any>(null);
  const [pendingP2P, setPendingP2P] = useState<any[]>([]);
  const [showP2PConfirm, setShowP2PConfirm] = useState(false);
  const [p2pConfirmItem, setP2pConfirmItem] = useState<any>(null);
  const [settleDirection, setSettleDirection] = useState<"me" | "friend">("me");
  const [pendingMsgs, setPendingMsgs] = useState<any[]>([]);
  const [speakLang, setSpeakLang] = useState("ar-EG");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [translateTarget, setTranslateTarget] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [imageTexts, setImageTexts] = useState<Record<string, string>>({});
  const [extractingImg, setExtractingImg] = useState<string | null>(null);
  const [audioTexts, setAudioTexts] = useState<Record<string, string>>({});
  const [transcribingAudio, setTranscribingAudio] = useState<string | null>(null);
  const [myPrivKey, setMyPrivKey] = useState<CryptoKey | null>(null);
  const [myPubKey, setMyPubKey] = useState<string>("");
  const [friendPubKeys, setFriendPubKeys] = useState<Record<string, string>>({});
  const [e2eReady, setE2eReady] = useState(false);
  const [showKeyRecovery, setShowKeyRecovery] = useState(false);
  const [recoveryPin, setRecoveryPin] = useState("");
  const [recoveryErr, setRecoveryErr] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  // ─── PIN لفتح/إنشاء المفتاح الخاص (لا يُخزّن في أي storage) ───
  const [showPinUnlock, setShowPinUnlock] = useState(false);
  const [pinUnlockInput, setPinUnlockInput] = useState("");
  const [pinUnlockErr, setPinUnlockErr] = useState("");
  const [pinUnlockLoading, setPinUnlockLoading] = useState(false);
  const [unlockWaitMs, setUnlockWaitMs] = useState(0);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const friendsRef = useRef<Friend[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const chatFriendRef = useRef<Friend | null>(null);
  const selectedFriendRef = useRef<Friend | null>(null);

  // حدّث المراجع عند تغيير الحالة
  useEffect(() => { chatFriendRef.current = chatFriend; }, [chatFriend]);
  useEffect(() => { selectedFriendRef.current = selectedFriend; }, [selectedFriend]);

  // تحميل مرة واحدة عند البداية + استطلاع خفيف
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

  // استمع لزر الرجوع — تنقّل داخلي
  useEffect(() => {
    const backHandler = () => {
      if (chatFriendRef.current) {
        closeChat();
      } else if (selectedFriendRef.current) {
        setSelectedFriend(null);
        localStorage.removeItem("alrafeeq-selected-ship");
      }
    };
    window.addEventListener("app-back", backHandler);
    return () => window.removeEventListener("app-back", backHandler);
  }, []);

  async function load() {
    if (isInitialLoad) setLoading(true);
    const userId = await getResolvedUserId();
    if (!userId) { setLoading(false); setIsInitialLoad(false); return; }
    setUid(userId);
    await loadFriends(userId);
    await loadPendingDebts(userId);
    await loadPendingSettlements(userId);
    fetchPendingRelReqs();
    setLoading(false);
    // استعد الشات/الصديق المحفوظ مرة واحدة فقط عند التحميل الأول
    if (isInitialLoad) {
      const savedChat = localStorage.getItem("alrafeeq-chat-ship");
      const savedFriend = localStorage.getItem("alrafeeq-selected-ship");
      if (savedChat) {
        setTimeout(() => {
          const f = friendsRef.current.find((x) => x.friendship_id === savedChat);
          if (f) openChat(f);
        }, 100);
      } else if (savedFriend) {
        setTimeout(() => {
          const f = friendsRef.current.find((x) => x.friendship_id === savedFriend);
          if (f) {
            setSelectedFriend(f);
            loadFriendDetails(userId, f.friend_id);
          }
        }, 100);
      }
      setIsInitialLoad(false);
    }
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
    localStorage.setItem("alrafeeq-chat-ship", friend.friendship_id);
    localStorage.removeItem("alrafeeq-selected-ship");
    setMessages([]);
    fetchPendingP2P();
    // استعد الرسائل المعلّقة من localStorage لهذا الشات
    const pending = JSON.parse(localStorage.getItem("alrafeeq-pending-msgs") || "[]")
      .filter((pm: any) => pm.shipId === friend.friendship_id)
      .map((pm: any) => ({
        id: pm.tempId,
        sender_id: pm.uid,
        content: pm.content,
        type: "text",
        created_at: pm.created_at,
        read_at: null,
        pending: true,
      }));
    if (pending.length > 0) setMessages(pending);
    await loadMessages(friend.friendship_id);
    subscribeToMessages(friend.friendship_id);
    // حاول إعادة إرسال المعلّق
    retryPendingMsgs();
  }

  function closeChat() {
    if (chatChannelRef.current) {
      chatChannelRef.current.unsubscribe();
      chatChannelRef.current = null;
    }
    localStorage.removeItem("alrafeeq-chat-ship");
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
      .select("id, sender_id, content, type, created_at, read_at, file_url, file_name, file_size, mime_type")
      .eq("friendship_id", friendshipId)
      .order("created_at", { ascending: true })
      .limit(100);
    // ─── فكّ تشفير الرسائل المشفّرة ───
    let processedMsgs = data || [];
    if (e2eReady && myPrivKey) {
      processedMsgs = await Promise.all(processedMsgs.map(async (m: any) => {
        if (m.content && typeof m.content === "string" && m.content.startsWith("ENC:") && m.sender_id !== uid) {
          try {
            const friendId = m.sender_id === uid ? chatFriendRef.current?.friend_id : m.sender_id;
            const friendPub = friendId ? await getFriendPubKey(friendId) : null;
            if (friendPub) {
              const encB64 = m.content.slice(4); // أزل "ENC:"
              m.content = await decryptMessage(encB64, myPrivKey, friendPub);
            } else {
              m.content = "[رسالة مشفّرة — لا يمكن فك تشفيرها]";
            }
          } catch {
            m.content = "[فشل فك التشفير]";
          }
        } else if (m.content && typeof m.content === "string" && m.content.startsWith("ENC:") && m.sender_id === uid) {
          // رسالتي المشفّرة ← استبدلها بالنص الأصلي غير المتاح
          m.content = "[رسالة مرسلة مشفّرة]";
        }
        return m;
      }));
    }
    setMessages(processedMsgs);
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
          // ─── فكّ تشفير الرسالة الجديدة ───
          const newMsg = { ...payload.new };
          if (newMsg.content && typeof newMsg.content === "string" && newMsg.content.startsWith("ENC:") && newMsg.sender_id !== uid) {
            (async () => {
              try {
                const friendPub = await getFriendPubKey(newMsg.sender_id);
                if (friendPub && myPrivKey) {
                  const encB64 = newMsg.content.slice(4);
                  const decrypted = await decryptMessage(encB64, myPrivKey, friendPub);
                  newMsg.content = decrypted;
                } else {
                  newMsg.content = "[رسالة مشفّرة]";
                }
              } catch {
                newMsg.content = "[فشل فك التشفير]";
              }
              setMessages((prev) => {
                if (prev.find((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              if (newMsg.sender_id !== uid && !newMsg.read_at) {
                sb.from("messages").update({ read_at: new Date().toISOString() }).eq("id", newMsg.id);
              }
              setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            })();
            return;
          }
          // رسالة غير مشفّرة ← اعرضها مباشرة
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
    const plainText = msgInput.trim().slice(0, 2000).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const shipId = chatFriend.friendship_id;
    // ─── شفّر الرسالة قبل الإرسال ───
    let contentToSend = plainText;
    let isEncrypted = false;
    if (e2eReady && myPrivKey) {
      try {
        const friendPub = await getFriendPubKey(chatFriend.friend_id);
        if (friendPub) {
          contentToSend = "ENC:" + await encryptMessage(plainText, myPrivKey, friendPub);
          isEncrypted = true;
        }
      } catch {}
    }
    // أنشئ معرّف مؤقت
    const tempId = "temp-" + Date.now();
    const tempMsg = {
      id: tempId,
      sender_id: uid,
      content: plainText, // اعرض النص الأصلي محلياً
      type: "text",
      created_at: new Date().toISOString(),
      read_at: null,
      pending: true,
    };
    // أضف للواجهة فوراً
    setMessages((prev) => [...prev, tempMsg]);
    setMsgInput("");
    setMsgSending(true);
    const sb = getSupabase() as any;
    if (!sb) {
      // لا يوجد اتصال — احفظ في القائمة المحلية
      savePendingMsg(shipId, tempId, plainText);
      setMsgSending(false);
      return;
    }
    const { error } = await sb.from("messages").insert({
      friendship_id: shipId,
      sender_id: uid,
      content: contentToSend, // النص المشفّر
      type: "text",
    });
    if (error) {
      // فشل الإرسال — احفظ في القائمة المحلية
      savePendingMsg(shipId, tempId, plainText);
    } else {
      // نجح — احذف الرسالة المؤقتة (الرسالة الحقيقية ستأتي عبر realtime)
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
    setMsgSending(false);
  }

  // رفع ملف للشات
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !chatFriend || !uid) return;
    // حد الحجم 50MB
    if (file.size > 50 * 1024 * 1024) {
      showToast("الملف كبير — الحد الأقصى 50MB");
      e.target.value = "";
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const msgType = isImage ? "image" : isAudio ? "audio" : "file";
    // معرّف مؤقت
    const tempId = "temp-" + Date.now();
    const tempMsg = {
      id: tempId,
      sender_id: uid,
      content: "",
      type: msgType,
      created_at: new Date().toISOString(),
      read_at: null,
      pending: true,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setMsgSending(true);
    const sb = getSupabase() as any;
    if (!sb) { setMsgSending(false); e.target.value = ""; return; }
    // ارفع الملف عبر API route آمن (server-side + magic bytes)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", `chat/${chatFriend.friendship_id}`);
    const upRes = await fetch("/api/upload", { method: "POST", body: formData });
    const upData = await upRes.json();
    if (!upData.ok) {
      showToast(upData.error || "تعذّر رفع الملف");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMsgSending(false);
      e.target.value = "";
      return;
    }
    const fileUrl = upData.url;
    // أرسل الرسالة
    const { data: msgData, error: msgErr } = await sb.from("messages").insert({
      friendship_id: chatFriend.friendship_id,
      sender_id: uid,
      content: "",
      type: msgType,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    }).select();
    if (!msgErr && msgData && msgData[0]) {
      // استبدل المؤقتة بالحقيقية
      setMessages((prev) => prev.map((m) => m.id === tempId ? msgData[0] : m));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
    setMsgSending(false);
    e.target.value = "";
  }

  // ─── تفريغ الصوت من الميكرفون ───
  async function transcribeAudio(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", blob, `friends-mic-${Date.now()}.webm`);
    const res = await fetch("/api/mic-test", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || "فشل تفريغ الصوت");
    return data.transcript || "";
  }

  async function toggleMic() {
    if (transcribing) return;
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      setMsgInput("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 500) return;
        setTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          if (!text) { setTranscribing(false); return; }
          // اكتشف لغة النص المفرّغ
          const isArabic = /[\u0600-\u06FF]/.test(text);
          const chosenCode = speakLang.split("-")[0]; // ar, en, fr...
          const textLang = isArabic ? "ar" : "en";
          // لو اللغة المختارة مختلفة ← ترجم تلقائياً
          if (textLang !== chosenCode) {
            try {
              const trRes = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${textLang}|${chosenCode}`
              );
              const trData = await trRes.json();
              if (trData?.responseData?.translatedText) {
                setMsgInput(trData.responseData.translatedText);
                showToast("تم تفريغ وترجمة الصوت");
                setTranscribing(false);
                return;
              }
            } catch {}
          }
          // لو نفس اللغة ← ضع النص مباشرة
          setMsgInput(text);
        } catch {
          showToast("فشل تفريغ الصوت");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      showToast("تعذّر الوصول للميكرفون");
    }
  }

  // ─── استخلاص النص من الصور ───
  async function extractImageText(msgId: string, imageUrl: string) {
    setExtractingImg(msgId);
    try {
      // حمّل الصورة كـ Blob
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("image", blob, `chat-img-${msgId}.jpg`);
      const apiRes = await fetch("/api/image-text", { method: "POST", body: formData });
      const data = await apiRes.json();
      if (!apiRes.ok || !data.ok) throw new Error(data?.error || "فشل التحليل");
      const extractedText = data.text || "لم يتم العثور على نص";
      setImageTexts((prev) => ({ ...prev, [msgId]: extractedText }));
    } catch {
      showToast("تعذّر استخلاص النص من الصورة");
    }
    setExtractingImg(null);
  }

  // ─── تفريغ صوت رسالة مستلمة ───
  async function transcribeAudioMessage(msgId: string, audioUrl: string) {
    setTranscribingAudio(msgId);
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("audio", blob, `audio-msg-${msgId}.webm`);
      const apiRes = await fetch("/api/mic-test", { method: "POST", body: formData });
      const data = await apiRes.json();
      if (!apiRes.ok || !data.ok) throw new Error(data?.error || "فشل التفريغ");
      const text = data.transcript || "لم يتم التعرف على صوت";
      setAudioTexts((prev) => ({ ...prev, [msgId]: text }));
    } catch {
      showToast("تعذّر تفريغ الصوت");
    }
    setTranscribingAudio(null);
  }

  // ─── تهيئة مفاتيح التشفير ───
  // المفتاح الخاص: محلي (IndexedDB) + نسخة مشفّرة بالـ PIN سحابياً
  // ─── فتح المفتاح الخاص بـ PIN (مباشرة في الذاكرة — لا storage) ───
  async function handlePinUnlock() {
    setPinUnlockErr("");
    // تحقق من القفل المحلي (brute-force protection)
    const status = getUnlockStatus();
    if (status.locked) {
      setUnlockWaitMs(status.waitMs);
      setPinUnlockErr("محاولات كثيرة — انتظر");
      return;
    }
    if (pinUnlockInput.length < 4) {
      setPinUnlockErr("الرمز يجب أن يكون 4 خانات على الأقل");
      return;
    }
    setPinUnlockLoading(true);
    try {
      const userId = getUserIdSync();
      if (!userId) return;
      const sb = getSupabase() as any;
      if (!sb) return;

      const hasLocalKey = await hasEncryptedKey();
      if (hasLocalKey) {
        // ─── فتح المفتاح الموجود ───
        const ok = await unlockPrivateKey(pinUnlockInput);
        if (!ok) {
        const st = getUnlockStatus();
        if (st.locked) {
          setUnlockWaitMs(st.waitMs);
          setPinUnlockErr("محاولات كثيرة — انتظر " + Math.ceil(st.waitMs / 1000) + " ثانية");
        } else {
          setPinUnlockErr("الرمز غير صحيح");
        }
        setPinUnlockLoading(false);
        return;
      }
        const priv = getActivePrivateKey();
        if (priv) {
          setMyPrivKey(priv);
          const { data: profile } = await sb.from("profiles")
            .select("pubkey").eq("id", userId).maybeSingle();
          if (profile?.pubkey) setMyPubKey(profile.pubkey);
          setE2eReady(true);
        }
      } else {
        // ─── إنشاء مفتاح جديد مشفّر بالـ PIN ───
        const pub = await generateKeyPair(pinUnlockInput);
        const priv = getActivePrivateKey();
        // لاحقاً: ارفع نسخة سحابية مشفّرة عند أول verify-pin ناجح
        if (priv) {
          setMyPrivKey(priv);
          setMyPubKey(pub);
          await sb.from("profiles").update({ pubkey: pub }).eq("id", userId);
          setE2eReady(true);
        }
      }
      // امحُ PIN من المتغيّر المحلي فوراً
      setPinUnlockInput("");
      setShowPinUnlock(false);
    } catch {
      setPinUnlockErr("تعذّر فتح المفتاح");
    }
    setPinUnlockLoading(false);
  }

  async function initE2EKeys(userId: string) {
    try {
      const sb = getSupabase() as any;
      if (!sb) return;

      const { data: profile } = await sb.from("profiles")
        .select("pubkey, encrypted_privkey, email").eq("id", userId).maybeSingle();

      // ─── تحقق هل يوجد مفتاح مشفّر محلياً ───
      const hasLocalKey = await hasEncryptedKey();
      const priv = getActivePrivateKey(); // من الذاكرة فقط

      if (priv) {
        // ─── المفتاح مفتوح في الذاكرة ───
        setMyPrivKey(priv);
        if (profile?.pubkey) setMyPubKey(profile.pubkey);
        setE2eReady(true);
      } else if (hasLocalKey) {
        // ─── يوجد مفتاح مشفّر ← اطلب PIN لفتحه ───
        setShowPinUnlock(true); // يظهر modal لإدخال PIN
      } else if (profile?.encrypted_privkey) {
        // ─── ضاع المحلي لكن توجد نسخة سحابية ───
        setShowKeyRecovery(true);
      } else {
        // ─── لا مفتاح محلي ولا سحابي ← اطلب PIN للإنشاء ───
        setShowPinUnlock(true); // نفس الـ modal يولّد جديد
      }
    } catch {
      setE2eReady(false);
    }
  }

  // ─── استرجاع المفتاح الخاص من النسخة السحابية ───
  async function recoverKeyFromCloud() {
    setRecoveryErr("");
    if (!recoveryPin || !uid) { setRecoveryErr("اكتب الرمز"); return; }
    setRecoveryLoading(true);
    try {
      const sb = getSupabase() as any;
      if (!sb) { setRecoveryLoading(false); return; }
      const { data: profile } = await sb.from("profiles")
        .select("encrypted_privkey, email, pubkey").eq("id", uid).maybeSingle();
      if (!profile?.encrypted_privkey || !profile?.email) {
        setRecoveryErr("لا توجد نسخة احتياطية");
        setRecoveryLoading(false);
        return;
      }
      // فكّ تشفير المفتاح الخاص بالـ PIN
      const recovered = await decryptPrivateKeyFromBackup(
        profile.encrypted_privkey, recoveryPin, profile.email
      );
      if (!recovered) {
        setRecoveryErr("الرمز خاطئ");
        setRecoveryLoading(false);
        return;
      }
      // خزّن المفتاح الخاص محلياً
      const privRaw = await crypto.subtle.exportKey("pkcs8", recovered);
      // أعد تخزينه في IndexedDB
      await storePrivKeyLocal(privRaw);
      setMyPrivKey(recovered);
      setMyPubKey(profile.pubkey || "");
      setE2eReady(true);
      setShowKeyRecovery(false);
      setRecoveryPin("");
      showToast("تم استرجاع مفاتيح التشفير");
    } catch {
      setRecoveryErr("خطأ في الاسترجاع");
    }
    setRecoveryLoading(false);
  }

  // ─── خزّن المفتاح الخاص في IndexedDB (مجلّد) ───
  async function storePrivKeyLocal(key: ArrayBuffer) {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("alrafeeq-keys", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("alrafeeq-priv-key")) {
          db.createObjectStore("alrafeeq-priv-key");
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("alrafeeq-priv-key", "readwrite");
        tx.objectStore("alrafeeq-priv-key").put(key, "priv");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  // ─── ارفع نسخة احتياطية مشفّرة بالـ PIN ───
  // تُستدعى بعد كل عملية PIN ناجحة (تأكيد دين/تسوية)
  async function uploadEncryptedBackup(pin: string) {
    if (!myPrivKey || !uid) return;
    try {
      const sb = getSupabase() as any;
      if (!sb) return;
      const { data: profile } = await sb.from("profiles")
        .select("email").eq("id", uid).maybeSingle();
      if (!profile?.email) return;
      const encPriv = await encryptPrivateKeyForBackup(myPrivKey, pin, profile.email);
      await sb.from("profiles").update({ encrypted_privkey: encPriv }).eq("id", uid);
    } catch {}
  }

  // ─── احصل على المفتاح العام لصديق (مع تخزين مؤقت) ───
  async function getFriendPubKey(friendId: string): Promise<string | null> {
    // تحقق من التخزين المؤقت
    if (friendPubKeys[friendId]) return friendPubKeys[friendId];
    const sb = getSupabase() as any;
    if (!sb) return null;
    const { data: profile } = await sb.from("profiles")
      .select("pubkey").eq("id", friendId).maybeSingle();
    if (profile?.pubkey) {
      setFriendPubKeys((prev) => ({ ...prev, [friendId]: profile.pubkey }));
      return profile.pubkey;
    }
    return null;
  }

  // ─── تهيئة المفاتيح عند تحميل المكوّن ───
  useEffect(() => {
    getResolvedUserId().then((id) => {
      if (id) initE2EKeys(id);
    });
  }, []);

  // تنظيف الميكرفون عند الخروج
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // نطق الرسالة صوتياً (Google TTS أولاً، ثم المتصفح احتياطياً)
  async function speakMessage(text: string, lang?: string) {
    const targetLang = lang || speakLang;
    // أولاً: جرّب Google Cloud TTS (أصوات طبيعية مميزة)
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lang: targetLang.startsWith("ar") ? "ar-XA" : "en-US",
          voice: "female",
          rate: 1.0,
        }),
      });
      const data = await res.json();
      if (data.ok && data.audio) {
        const audio = new Audio("data:audio/mp3;base64," + data.audio);
        audio.play().catch(() => speakWithBrowser(text, targetLang));
        return;
      }
    } catch {
      // تجاهل ← استخدم المتصفح
    }
    speakWithBrowser(text, targetLang);
  }

  // النطق بمتصفح الويب (Web Speech API)
  function speakWithBrowser(text: string, lang: string) {
    if (!window.speechSynthesis) {
      showToast("المتصفح لا يدعم النطق الصوتي");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }

  // جلب وسائل الدفع المشتركة
  async function fetchP2PMethods() {
    if (!chatFriend || !uid) return;
    setP2pLoading(true);
    try {
      const friendRes = await fetch("/api/payment-methods?friend_id=" + chatFriend.friend_id, { headers: { ...(await getAuthHeaders()) } });
      const friendData = await friendRes.json();
      const friendMethods = friendData.ok ? (friendData.methods || []) : [];
      const myRes = await fetch("/api/payment-methods", { headers: { ...(await getAuthHeaders()) } });
      const myData = await myRes.json();
      const myMethods = myData.ok ? (myData.methods || []) : [];
      const myMethodTypes = new Set(myMethods.map((m: any) => m.method));
      const shared = friendMethods.filter((m: any) => myMethodTypes.has(m.method));
      setP2pFriendMethods(shared);
    } catch { setP2pFriendMethods([]); }
    setP2pLoading(false);
  }

  // جلب الاقساط بين الصديقين
  async function fetchP2PInstallments() {
    if (!chatFriend || !uid) return;
    setP2pLoading(true);
    const sb = getSupabase();
    if (!sb) { setP2pLoading(false); return; }
    const { data } = await sb.from("debt_requests")
      .select("id, amount, description, is_installment, total_installments, installment_amount, paid_installments, status")
      .eq("is_installment", true)
      .eq("status", "confirmed")
      .or("and(creditor.eq." + uid + ",debtor.eq." + chatFriend.friend_id + "),and(creditor.eq." + chatFriend.friend_id + ",debtor.eq." + uid + ")");
    const unpaid = ((data || []) as any[]).filter((d: any) => (d.paid_installments || 0) < (d.total_installments || 0));
    setP2pItems(unpaid);
    setP2pLoading(false);
    setP2pStep("items");
  }

  // جلب الجمعية المشتركة
  async function loadUnifiedItems(cat: "installment" | "gam3eya") {
    if (!chatFriend || !uid) return;
    if (cat === "installment") {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.from("debt_requests")
        .select("id, amount, description, is_installment, total_installments, installment_amount, paid_installments, status")
        .eq("is_installment", true)
        .eq("status", "confirmed")
        .or("and(creditor.eq." + uid + ",debtor.eq." + chatFriend.friend_id + "),and(creditor.eq." + chatFriend.friend_id + ",debtor.eq." + uid + ")");
      const unpaid = ((data || []) as any[]).filter((d: any) => (d.paid_installments || 0) < (d.total_installments || 0));
      setP2pItems(unpaid);
    } else {
      if (chatFriend.gam3eya_total && chatFriend.gam3eya_amount) {
        setP2pItems([{
          id: "gam3eya",
          amount: chatFriend.gam3eya_amount,
          total: chatFriend.gam3eya_total,
          completed: chatFriend.gam3eya_completed || 0,
        }]);
      } else {
        setP2pItems([]);
      }
    }
  }

    async function fetchP2PGam3eya() {
    if (!chatFriend) return;
    setP2pLoading(true);
    if (chatFriend.gam3eya_total && chatFriend.gam3eya_amount) {
      setP2pItems([{
        amount: chatFriend.gam3eya_amount,
        description: "جمعية " + chatFriend.gam3eya_total + " دورات",
        total: chatFriend.gam3eya_total,
        completed: chatFriend.gam3eya_completed || 0,
      }]);
    } else {
      setP2pItems([]);
    }
    setP2pLoading(false);
    setP2pStep("items");
  }

  // فتح نافذة P2P — يجلب وسائل دفع الصديق + وسائلي أنا (للتطابق)
  async function openP2P() {
    if (!chatFriend) return;
    setChatShowP2P(true);
    setP2pStep("category");
    setP2pCategory(null);
    setP2pItems([]);
    setP2pSelectedItem(null);
    setP2pAmount("");
    setP2pSelectedMethod(null);
    setP2pResult(null);
    setP2pLoading(true);
    try {
      // اجلب وسائل الصديق
      const friendRes = await fetch(`/api/payment-methods?friend_id=${chatFriend.friend_id}`, {
        headers: { ...(await getAuthHeaders()) },
      });
      const friendData = await friendRes.json();
      const friendMethods = friendData.ok ? (friendData.methods || []) : [];
      // اجلب وسائلي أنا
      const myRes = await fetch("/api/payment-methods", {
        headers: { ...(await getAuthHeaders()) },
      });
      const myData = await myRes.json();
      const myMethods = myData.ok ? (myData.methods || []) : [];
      // اعرض فقط الوسائل المشتركة (نفس النوع لكلا الطرفين)
      const myMethodTypes = new Set(myMethods.map((m: any) => m.method));
      const shared = friendMethods.filter((m: any) => myMethodTypes.has(m.method));
      setP2pFriendMethods(shared);
    } catch {
      setP2pFriendMethods([]);
    }
    setP2pLoading(false);
  }

  // بدء معاملة P2P
  async function initiateP2P() {
    if (!chatFriend || !p2pAmount || !p2pSelectedMethod) return;
    setP2pLoading(true);
    try {
      const res = await fetch("/api/p2p/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          to_user: chatFriend.friend_id,
          friendship_id: chatFriend.friendship_id,
          amount: p2pAmount,
          method: p2pSelectedMethod.method,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setP2pResult(data);
        setP2pStep("done");
      } else {
        showToast(data.error || "تعذّر بدء المعاملة");
      }
    } catch {
      showToast("خطأ في الاتصال");
    }
    setP2pLoading(false);
  }

  // رفع إيصال P2P
  async function uploadP2PReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !p2pResult?.id || !chatFriend || !uid) return;
    setP2pReceiptUploading(true);
    const sb = getSupabase() as any;
    if (!sb) { setP2pReceiptUploading(false); e.target.value = ""; return; }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", `p2p-receipts/${p2pResult.id}`);
    formData.append("expiry", "86400");
    const upRes = await fetch("/api/upload", { method: "POST", body: formData });
    const upData = await upRes.json();
    if (!upData.ok) { showToast(upData.error || "تعذّر رفع الإيصال"); setP2pReceiptUploading(false); e.target.value = ""; return; }
    const receiptUrl = upData.url;
    if (!receiptUrl) { showToast("تعذّر الحصول على رابط"); setP2pReceiptUploading(false); e.target.value = ""; return; }
    // أرسل للـ API
    try {
      const res = await fetch("/api/p2p/upload-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ transaction_id: p2pResult.id, receipt_url: receiptUrl }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("تم رفع الإيصال — بانتظار تأكيد الاستلام");
        setChatShowP2P(false);
      } else {
        showToast(data.error || "تعذّر تحديث المعاملة");
      }
    } catch {
      showToast("خطأ في الاتصال");
    }
    setP2pReceiptUploading(false);
    e.target.value = "";
  }

  // جلب معاملات P2P المعلّقة لتأكيد الاستلام (أنا = المستلم)
  async function fetchPendingP2P() {
    if (!chatFriend || !uid) return;
    try {
      const res = await fetch("/api/p2p?status=verifying", {
        headers: { ...(await getAuthHeaders()) },
      });
      const data = await res.json();
      if (data.ok) {
        // فلتر: المعاملات التي المستلم فيها = أنا
        const mine = (data.transactions || []).filter((t: any) => t.to_user === uid && t.from_user === chatFriend.friend_id);
        setPendingP2P(mine);
      }
    } catch {}
  }

  // تأكيد استلام P2P
  async function confirmP2P(transactionId: string, confirmed: boolean) {
    if (!uid) return;
    setP2pLoading(true);
    try {
      const res = await fetch("/api/p2p/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ transaction_id: transactionId, confirmed }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(confirmed ? "تم التأكيد — أُنشئ السند ✅" : "تم فتح الخلاف");
        setShowP2PConfirm(false);
        setP2pConfirmItem(null);
        fetchPendingP2P();
      } else {
        showToast(data.error || "تعذّر التأكيد");
      }
    } catch {
      showToast("خطأ في الاتصال");
    }
    setP2pLoading(false);
  }

  // ترجمة رسالة
  async function translateMessage(msgId: string, text: string, targetLang: string) {
    setTranslating(msgId);
    try {
      // اكتشف لغة المصدر (افترض العربية لو نص عربي)
      const srcLang = /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|${targetLang}`
      );
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        setTranslations((prev) => ({ ...prev, [msgId]: data.responseData.translatedText }));
      } else {
        showToast("تعذّرت الترجمة");
      }
    } catch {
      showToast("خطأ في الترجمة — تأكد من الإنترنت");
    }
    setTranslating(null);
  }

  // اختيار لغة ثم ترجمة
  function onTranslateClick(msgId: string, text: string) {
    setTranslateTarget(msgId);
    setShowLangPicker(true);
  }

  // قائمة اللغات
  const LANGS = [
    { code: "ar", label: "العربية", speak: "ar-EG" },
    { code: "en", label: "English", speak: "en-US" },
    { code: "fr", label: "Français", speak: "fr-FR" },
    { code: "es", label: "Español", speak: "es-ES" },
    { code: "de", label: "Deutsch", speak: "de-DE" },
    { code: "tr", label: "Türkçe", speak: "tr-TR" },
    { code: "ur", label: "اردو", speak: "ur-PK" },
    { code: "fa", label: "فارسی", speak: "fa-IR" },
  ];

  // احفظ رسالة معلّقة في localStorage
  function savePendingMsg(shipId: string, tempId: string, content: string) {
    const key = "alrafeeq-pending-msgs";
    const all = JSON.parse(localStorage.getItem(key) || "[]");
    all.push({ shipId, tempId, content, uid, created_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(all));
    setPendingMsgs(all);
  }

  // أعد إرسال الرسائل المعلّقة عند عودة الإنترنت
  async function retryPendingMsgs() {
    const key = "alrafeeq-pending-msgs";
    const all = JSON.parse(localStorage.getItem(key) || "[]");
    if (all.length === 0) return;
    const sb = getSupabase() as any;
    if (!sb) return;
    const remaining: any[] = [];
    let anySent = false;
    for (const pm of all) {
      const { data, error } = await sb.from("messages").insert({
        friendship_id: pm.shipId,
        sender_id: pm.uid,
        content: pm.content,
        type: "text",
      }).select();
      if (!error && data && data[0]) {
        // نجح ← استبدل الرسالة المؤقتة بالحقيقية (تبقى ظاهرة)
        const realMsg = data[0];
        setMessages((prev) => prev.map((m) =>
          m.id === pm.tempId ? realMsg : m
        ));
        anySent = true;
      } else {
        remaining.push(pm);
      }
    }
    localStorage.setItem(key, JSON.stringify(remaining));
    setPendingMsgs(remaining);
    // لو أرسلنا رسائل ← أعد تحميل الرسائل للتأكد من التزامن
    if (anySent && chatFriendRef.current) {
      await loadMessages(chatFriendRef.current.friendship_id);
    }
  }

  // استمع لعودة الإنترنت
  useEffect(() => {
    const onOnline = () => retryPendingMsgs();
    window.addEventListener("online", onOnline);
    // استعد اللغة المحفوظة
    const savedLang = localStorage.getItem("alrafeeq-lang");
    if (savedLang) setSpeakLang(savedLang);
    return () => window.removeEventListener("online", onOnline);
  }, []);

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
    setChatShowUnified(false);
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
    const fromUser = settleDirection === "me" ? uid : chatFriend.friend_id;
    const toUser = settleDirection === "me" ? chatFriend.friend_id : uid;
    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user: fromUser,
          to_user: toUser,
          friendship_id: chatFriend.friendship_id,
          amount: amt,
          description: (settleCategory === "debt" ? "دين" : settleCategory === "installment" ? "قسط" : "جمعية") + (settleDesc ? " — " + settleDesc : ""),
          linked_debt_id: p2pSelectedItem?.id || null,
          status: "pending",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setActionErr(data.error || "تعذّر إرسال التسوية"); setSubmitting(false); return; }
    } catch { setActionErr("خطأ في الاتصال"); setSubmitting(false); return; }
    await sendSystemMessage(chatFriend.friendship_id,
      (settleDirection === "me" ? "لي عنده: " : "أخذت منه: ") + amt + " جنيه" + (settleDesc ? " — " + settleDesc : ""));
    setSettleAmount(""); setSettleDesc(""); setSettleDirection("me");
    setChatShowUnified(false);
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
    friendsRef.current = friendList;
    // أرسل إجمالي الرسائل غير المقروءة للتبويب
    const totalUnread = friendList.reduce((s, f) => s + f.unread_count, 0) + pendingDebts.length + pendingSetts.length;
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
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, accessToken: session?.access_token }),
      });
      const data = await res.json();
      setAdding(false);
      if (data.error) { setErr(data.error); return; }
      setPhoneInput("");
      setShowAdd(false);
      await load();
      showToast(data.message || "تم إرسال طلب الصداقة");
    } catch { setErr("خطأ في الاتصال"); setAdding(false); }
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
    // حدّد دور الطرفين تلقائياً
    const myRole = relationType;
    const theirRole = getPairedRole(relationType);
    const updateData: any = { 
      relationship_type: relationType,
      // role_a = دور المُنشئ (initiator)، role_b = دور الطرف الآخر
      role_a: myRole,
      role_b: theirRole,
    };
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
      employer: "مدير",
      colleague: "يعمل مع",
      partner: "شريك",
      client: "عميل",
      association: "جمعية",
      member: "عضو جمعية",
    };
    return labels[type] || "صديق";
  }

  // جلب طلبات تغيير العلاقة المعلّقة
  async function fetchPendingRelReqs() {
    if (!uid) return;
    try {
      const res = await fetch("/api/relationship-change", { headers: { ...(await getAuthHeaders()) } });
      const data = await res.json();
      if (data.ok) setPendingRelReqs(data.requests || []);
    } catch {}
  }

  // إرسال طلب تغيير علاقة
  async function sendRelReq() {
    if (!relReqShip || !relReqRole || !uid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/relationship-change", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ friendship_id: relReqShip, requested_role: relReqRole, reason: relReqReason }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("تم إرسال طلب التغيير");
        setShowRelReq(false);
        setRelReqRole(""); setRelReqReason(""); setRelReqShip(null);
      } else {
        showToast(data.error || "تعذّر الإرسال");
      }
    } catch {
      showToast("خطأ في الاتصال");
    }
    setSubmitting(false);
  }

  // الرد على طلب تغيير علاقة
  async function respondRelReq(reqId: string, approved: boolean) {
    if (!uid) return;
    try {
      const res = await fetch("/api/relationship-change", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ request_id: reqId, approved }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(approved ? "تمت الموافقة وتحديث العلاقة" : "تم الرفض");
        fetchPendingRelReqs();
        await load();
      }
    } catch {}
  }

  // منطق الإقتران التلقائي للعلاقات
  // عند اختيار دور ← يُحدّد دور الطرف الآخر تلقائياً
  function getPairedRole(myRole: string): string {
    const pairs: Record<string, string> = {
      employer: "colleague",      // مدير ← يعمل مع
      colleague: "employer",      // يعمل مع ← مدير
      partner: "partner",         // شريك ← شريك
      association: "member",      // جمعية (أنا مدير) ← عضو
      member: "association",      // عضو ← جمعية (هو مدير)
      friend: "friend",          // صديق ← صديق
      client: "client",          // عميل ← عميل (متماثل)
    };
    return pairs[myRole] || "friend";
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
          const { error: updErr } = await sb2.from(table)
            .update({ status, confirmed_at: new Date().toISOString() })
            .eq("id", pendingAction.id);
          if (updErr) {
            console.error("confirm update error:", updErr);
            setPinErr("تعذّر التحديث — حاول مرة أخرى");
            setPinVerifying(false);
            return;
          }

          // لو تأكيد تسوية ← حدّث paid_installments للدين المختار فقط
          if (pendingAction.type === "settlement" && pendingAction.accept) {
            const { data: sett } = await sb2.from("settlements")
              .select("from_user, to_user, amount, friendship_id, description, linked_debt_id")
              .eq("id", pendingAction.id).maybeSingle();
            if (sett?.linked_debt_id) {
              // استخدم الدين المختار مباشرة — لا حاجة للمطابقة
              const { data: debt } = await sb2.from("debt_requests")
                .select("id, paid_installments, total_installments, installment_amount")
                .eq("id", sett.linked_debt_id).maybeSingle();
              if (debt) {
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
                  // ─── تحديث ذرّي: اقرأ ثم حدّث بشرط (منع race condition) ───
                  await sb2.rpc("increment_paid_installments", {
                    debt_id: debt.id,
                    inc_count: inc,
                    max_total: total,
                  });
                }
              }
            }
            // أنشئ سند هرمي موثّق + رسالة في الشات
            if (sett.friendship_id) {
              const cat = sett.description && sett.description.includes("قسط") ? "installment" :
                          sett.description && sett.description.includes("جمعية") ? "gam3eya" : "debt";
              try {
                const sanadRes = await fetch("/api/sanad", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
                  body: JSON.stringify({
                    friendship_id: sett.friendship_id,
                    type: "settlement",
                    category: cat,
                    to_user: sett.to_user,
                    amount: sett.amount,
                    description: sett.description,
                    linked_settlement_id: pendingAction.id,
                    status: "confirmed",
                  }),
                });
                if (!sanadRes.ok) {
                  const sanadErr = await sanadRes.json().catch(() => ({}));
                  console.error("sanad API error:", sanadErr);
                }
              } catch (e) { console.error("sanad fetch error:", e); }
              await sendSystemMessage(
                sett.friendship_id,
                "📄 سند " + new Date().toLocaleDateString("ar-EG") + "\n" +
                "الفئة: " + (cat === "installment" ? "قسط" : cat === "gam3eya" ? "جمعية" : "دين") + "\n" +
                "المبلغ: " + sett.amount + " جنيه\n" +
                (sett.description ? ("الوصف: " + sett.description + "\n") : "") +
                "الحالة: نهائي موثّق ✅"
              );
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
    const fromUser = settleDirection === "me" ? uid : selectedFriend.friend_id;
    const toUser = settleDirection === "me" ? selectedFriend.friend_id : uid;
    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user: fromUser,
          to_user: toUser,
          friendship_id: selectedFriend.friendship_id,
          amount: amt,
          description: settleDesc || null,
          status: "pending",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setActionErr(data.error || "تعذّر إرسال التسوية"); setSubmitting(false); return; }
    } catch { setActionErr("خطأ في الاتصال"); setSubmitting(false); return; }
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

        {/* بانر معاملات P2P بانتظار التأكيد */}
        {pendingP2P.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 p-2 space-y-2">
            {pendingP2P.map((t, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl p-2.5">
                <div className="flex-1">
                  <div className="text-xs font-bold text-amber-700">📄 إيصال بانتظار تأكيدك</div>
                  <div className="text-xs text-gray-500">{t.amount} ج — {t.method === "vodafone_cash" ? "فودافون كاش" : t.method === "instapay" ? "إنستاباي" : "أخرى"}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => confirmP2P(t.id, true)} disabled={p2pLoading}
                    className="bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40 flex items-center gap-1">
                    <Check size={12} /> تم الاستلام
                  </button>
                  <button onClick={() => { setP2pConfirmItem(t); setShowP2PConfirm(true); }}
                    className="bg-red-50 text-red-600 rounded-lg px-3 py-1.5 text-xs font-bold">
                    <X size={12} /> لم أستلم
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* بانرات التأكيد داخل الشات */}
        {chatFriend && pendingDebts.filter((d) => d.friend_id === chatFriend.friend_id && d.you_are === "debtor").length > 0 && (
          <div className="px-3 pt-2 space-y-2">
            {pendingDebts.filter((d) => d.friend_id === chatFriend.friend_id && d.you_are === "debtor").map((d) => (
              <div key={d.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-amber-700">📋 طلب دين عليك</div>
                  <div className="text-xs text-amber-600">{d.amount} جنيه {d.is_installment ? "(أقساط)" : ""}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => respondDebt(d.id, true)}
                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold flex items-center gap-1">
                    <Check size={14} /> موافق
                  </button>
                  <button onClick={() => respondDebt(d.id, false)}
                    className="px-3 py-1.5 rounded-lg bg-red-100 text-red-500 text-xs font-bold flex items-center gap-1">
                    <X size={14} /> رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {chatFriend && pendingSetts.filter((s) => s.friend_id === chatFriend.friend_id && s.status === "pending").length > 0 && (
          <div className="px-3 pt-2 space-y-2">
            {pendingSetts.filter((s) => s.friend_id === chatFriend.friend_id && s.status === "pending").map((s) => (
              <div key={s.id} className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-blue-700">🔄 طلب تسوية بانتظار تأكيدك</div>
                  <div className="text-xs text-blue-600">{s.amount} جنيه</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => respondSettlement(s.id, true)}
                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold flex items-center gap-1">
                    <Check size={14} /> تأكيد
                  </button>
                  <button onClick={() => respondSettlement(s.id, false)}
                    className="px-3 py-1.5 rounded-lg bg-red-100 text-red-500 text-xs font-bold flex items-center gap-1">
                    <X size={14} /> رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
                  {/* صورة */}
                  {m.type === "image" && m.file_url && (
                    <>
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block mb-1">
                        <img src={m.file_url} alt={m.file_name || "صورة"} className="rounded-xl max-w-full max-h-60 object-cover" />
                      </a>
                      {/* زر استخلاص النص */}
                      {!imageTexts[m.id] && (
                        <button onClick={() => extractImageText(m.id, m.file_url)}
                          disabled={extractingImg === m.id}
                          className={"flex items-center gap-1 text-[10px] py-1 px-2 rounded-lg mb-1 " + (mine ? "bg-white/10 text-white" : "bg-gray-50 text-gray-500")}>
                          {extractingImg === m.id ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
                          استخلاص النص
                        </button>
                      )}
                      {/* النص المستخرج */}
                      {imageTexts[m.id] && (
                        <div className={"text-sm mt-1 pt-1 border-t " + (mine ? "border-white/20" : "border-gray-100")}>
                          <span className={"text-[9px] " + (mine ? "text-white/50" : "text-gray-400")}>📝 </span>
                          {imageTexts[m.id]}
                        </div>
                      )}
                    </>
                  )}
                  {/* ملف */}
                  {m.type === "file" && m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" download={m.file_name}
                      className={"flex items-center gap-2 rounded-xl p-2 mb-1 " + (mine ? "bg-white/10" : "bg-gray-50")}>
                      <FileText size={20} className={mine ? "text-white" : "text-[var(--accent)]"} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{m.file_name}</div>
                        <div className={"text-[10px] " + (mine ? "text-white/60" : "text-gray-400")}>
                          {m.file_size ? Math.round(m.file_size / 1024) + " KB" : ""}
                        </div>
                      </div>
                      <Download size={16} className={mine ? "text-white" : "text-[var(--accent)]"} />
                    </a>
                  )}
                  {/* صوت */}
                  {m.type === "audio" && m.file_url && (
                    <>
                      <div className="mb-1">
                        <audio controls src={m.file_url} className="w-full max-w-[220px]" />
                      </div>
                      {/* زر تفريغ الصوت */}
                      {!audioTexts[m.id] && (
                        <button onClick={() => transcribeAudioMessage(m.id, m.file_url)}
                          disabled={transcribingAudio === m.id}
                          className={"flex items-center gap-1 text-[10px] py-1 px-2 rounded-lg mb-1 " + (mine ? "bg-white/10 text-white" : "bg-gray-50 text-gray-500")}>
                          {transcribingAudio === m.id ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
                          تفريغ الصوت
                        </button>
                      )}
                      {/* النص المفرّغ */}
                      {audioTexts[m.id] && (
                        <div className={"text-sm mt-1 pt-1 border-t " + (mine ? "border-white/20" : "border-gray-100")}>
                          <span className={"text-[9px] " + (mine ? "text-white/50" : "text-gray-400")}>🎤 </span>
                          {audioTexts[m.id]}
                        </div>
                      )}
                    </>
                  )}
                  {/* نص */}
                  {m.type === "text" && m.content && (
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  )}
                  {/* الترجمة أسفل الرسالة */}
                  {translations[m.id] && (
                    <div className={"text-sm mt-1 pt-1 border-t " + (mine ? "border-white/20" : "border-gray-100")}>
                      <span className={"text-[9px] " + (mine ? "text-white/50" : "text-gray-400")}>🌐 </span>
                      {translations[m.id]}
                    </div>
                  )}
                  <div className={"text-[9px] mt-0.5 flex items-center gap-2 " + (mine ? "text-white/60" : "text-gray-300")}>
                    <span>{new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                    {mine && (m.pending ? " 🕐" : m.read_at ? " ✓✓" : " ✓")}
                    {/* أزرار لكل رسالة نصية */}
                    {m.type === "text" && m.content && (
                      <>
                        <button onClick={() => onTranslateClick(m.id, m.content)}
                          className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                          title="ترجمة">
                          🌐
                        </button>
                        <button onClick={() => speakMessage(m.content)}
                          className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                          title="اسمع">
                          <Volume2 size={12} />
                        </button>
                      </>
                    )}
                    {/* أزرار للنص المستخرج من الصور */}
                    {imageTexts[m.id] && (
                      <>
                        <button onClick={() => onTranslateClick("img-" + m.id, imageTexts[m.id])}
                          className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                          title="ترجمة النص المستخرج">
                          🌐
                        </button>
                        <button onClick={() => speakMessage(imageTexts[m.id])}
                          className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                          title="اسمع النص المستخرج">
                          <Volume2 size={12} />
                        </button>
                      </>
                    )}
                    {/* أزرار للنص المفرّغ من الصوت */}
                    {audioTexts[m.id] && (
                      <>
                        <button onClick={() => onTranslateClick("aud-" + m.id, audioTexts[m.id])}
                          className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                          title="ترجمة الصوت المفرّغ">
                          🌐
                        </button>
                        <button onClick={() => speakMessage(audioTexts[m.id])}
                          className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                          title="اسمع الصوت المفرّغ">
                          <Volume2 size={12} />
                        </button>
                      </>
                    )}
                    {/* زر سماع للترجمة */}
                    {translations[m.id] && (
                      <button onClick={() => speakMessage(translations[m.id])}
                        className={"opacity-60 hover:opacity-100 " + (mine ? "text-white" : "text-gray-400")}
                        title="اسمع الترجمة">
                        <Volume2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-[var(--soft)] space-y-2">
          {/* صف أزرار الأموال */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setUnifiedCat("debt"); setUnifiedMethod("cash"); setChatShowUnified(true); }}
              className="flex items-center gap-1.5 bg-green-50 rounded-xl px-3 py-2 shrink-0"
              title="تسوية">
              <Banknote size={16} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent)]">تسوية</span>
            </button>
            {/* زر رفع الملفات */}
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2 shrink-0"
              title="إرفاق ملف">
              <Paperclip size={16} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-500">ملف</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.txt,.zip"
            />
          </div>
          {/* صف الإدخال والإرسال */}
          <div className="flex items-center gap-2">
            {/* زر الميكرفون */}
            <button onClick={toggleMic} disabled={transcribing || msgSending}
              className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-50 " +
                (recording ? "bg-red-500 text-white animate-pulse" :
                 transcribing ? "bg-violet-500 text-white" : "bg-gray-50 text-[var(--accent)]")}
              title={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}>
              {transcribing ? <Loader2 size={18} className="animate-spin" /> :
               recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input
              type="text"
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={recording ? "تسجيل... اضغط للإيقاف" : transcribing ? "تفريغ الصوت..." : "اكتب رسالة..."}
              disabled={recording || transcribing}
              className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-100 text-sm disabled:opacity-50"
            />
            {/* زر سماع للنص المكتوب/المفرّغ */}
            {msgInput.trim() && !recording && !transcribing && (
              <button onClick={() => speakMessage(msgInput)}
                className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center shrink-0"
                title="اسمع قبل الإرسال">
                <Volume2 size={18} />
              </button>
            )}
            <button onClick={sendMessage} disabled={msgSending || !msgInput.trim() || recording || transcribing}
              className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-40 shrink-0">
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* ===== المودال الموحّد للتسوية ===== */}
        {chatShowUnified && chatFriend && (
          <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setChatShowUnified(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">تسوية</h3>
                <button onClick={() => setChatShowUnified(false)} className="text-gray-400"><X size={20} /></button>
              </div>
              <p className="text-xs text-gray-400 mb-3">{chatFriend.friend_phone}</p>
              <div className="flex gap-1.5 mb-3">
                <button onClick={() => setUnifiedCat("debt")}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (unifiedCat === "debt" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>
                  دين
                </button>
                <button onClick={() => { setUnifiedCat("installment"); loadUnifiedItems("installment"); }}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (unifiedCat === "installment" ? "bg-amber-500 text-white" : "bg-gray-50 text-gray-400")}>
                  أقساط
                </button>
                <button onClick={() => { setUnifiedCat("gam3eya"); loadUnifiedItems("gam3eya"); }}
                  className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (unifiedCat === "gam3eya" ? "bg-violet-500 text-white" : "bg-gray-50 text-gray-400")}>
                  جمعية
                </button>
              </div>
              {unifiedCat === "debt" && (
                <>
                  <p className="text-[10px] text-violet-500 mb-3 bg-violet-50 rounded-lg px-2 py-1">📄 سيُنشأ سند توثيقي في الشات عند التأكيد</p>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setSettleDirection("me")} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "me" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>لي عنده</button>
                    <button onClick={() => setSettleDirection("friend")} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "friend" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>أخذت منه</button>
                  </div>
                  <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} placeholder="المبلغ الإجمالي بالجنيه" required className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
                  <input type="text" value={debtDesc} onChange={(e) => setDebtDesc(e.target.value)} placeholder="وصف (اختياري)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setIsInstallment(false)} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (!isInstallment ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>دفعة واحدة</button>
                    <button onClick={() => setIsInstallment(true)} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (isInstallment ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>أقساط</button>
                  </div>
                  {isInstallment && (
                    <div className="space-y-2 mb-3">
                      <input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} placeholder="عدد الأقساط" min={2} className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                      <input type="date" value={installmentStart} onChange={(e) => setInstallmentStart(e.target.value)} className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 text-sm" />
                      {debtAmount && totalInstallments && Number(totalInstallments) > 0 && (
                        <div className="bg-green-50 rounded-xl p-2 text-xs text-green-600 text-center">كل قسط: {Math.round((Number(debtAmount) / Number(totalInstallments)) * 100) / 100} جنيه × {totalInstallments} شهر</div>
                      )}
                    </div>
                  )}
                  {actionErr && <div className="text-red-500 text-sm mb-2 text-center">{actionErr}</div>}
                  <button onClick={() => { setChatShowUnified(false); sendChatDebtRequest(); }} disabled={submitting || !debtAmount} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">{submitting ? "جاري الإرسال..." : "إرسال طلب دين"}</button>
                </>
              )}
              {(unifiedCat === "installment" || unifiedCat === "gam3eya") && (
                <>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setUnifiedMethod("cash")} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (unifiedMethod === "cash" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>نقدي</button>
                    <button onClick={() => setUnifiedMethod("p2p")} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (unifiedMethod === "p2p" ? "bg-violet-500 text-white" : "bg-gray-50 text-gray-400")}>P2P</button>
                  </div>
                  {p2pItems.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <p className="text-[10px] text-gray-500">الأقساط المستحقة:</p>
                      {p2pItems.map((item: any, i: number) => (
                        <button key={i} onClick={() => setP2pSelectedItem(item)} className={"w-full text-right rounded-xl p-2.5 border transition " + (p2pSelectedItem === item ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold">{item.amount || item.installment_amount} جنيه</span><span className="text-[10px] text-gray-400">قسط {(item.paid_installments || 0) + 1}/{item.total_installments}</span></div>
                        </button>
                      ))}
                    </div>
                  )}
                  {unifiedMethod === "cash" && (
                    <>
                      <p className="text-[10px] text-violet-500 mb-3 bg-violet-50 rounded-lg px-2 py-1">📄 سيُنشأ سند توثيقي في الشات عند التأكيد</p>
                      <div className="flex gap-2 mb-3">
                        <button onClick={() => setSettleDirection("me")} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "me" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>لي عنده</button>
                        <button onClick={() => setSettleDirection("friend")} className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition " + (settleDirection === "friend" ? "bg-[var(--accent)] text-white" : "bg-gray-50 text-gray-400")}>أخذت منه</button>
                      </div>
                      <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} placeholder="المبلغ بالجنيه" required className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-2 text-sm" />
                      <input type="text" value={settleDesc} onChange={(e) => setSettleDesc(e.target.value)} placeholder="وصف الدفعة (اختياري)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-sm" />
                      {actionErr && <div className="text-red-500 text-sm mb-2 text-center">{actionErr}</div>}
                      <button onClick={() => { setSettleCategory(unifiedCat); setChatShowUnified(false); sendChatSettlement(); }} disabled={submitting || !settleAmount} className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">{submitting ? "جاري الإرسال..." : "إرسال طلب تأكيد"}</button>
                    </>
                  )}
                  {unifiedMethod === "p2p" && (
                    <>
                      <p className="text-[10px] text-violet-500 mb-3 bg-violet-50 rounded-lg px-2 py-1">💳 سيتم الدفع عبر وسيلة رقمية (QR + إيصال)</p>
                      <button onClick={() => { setChatShowUnified(false); openP2P(); }} className="w-full rounded-2xl bg-violet-500 text-white py-3 font-bold text-sm flex items-center justify-center gap-2"><CreditCard size={18} /> ابدأ معاملة P2P</button>
                    </>
                  )}
                </>
              )}
              <button onClick={() => setChatShowUnified(false)} className="w-full text-gray-400 py-2 mt-2 text-sm">إلغاء</button>
            </div>
          </div>
        )}

        {/* مودال معاملة P2P */}
        {chatShowP2P && chatFriend && (
          <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50" onClick={() => setChatShowP2P(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard size={20} className="text-violet-600" />
                  معاملة P2P
                </h3>
                <button onClick={() => setChatShowP2P(false)} className="text-gray-400"><X size={20} /></button>
              </div>

              {/* الخطوة 0: اختيار الفئة */}
              {p2pStep === "category" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-2">اختر نوع المعاملة:</p>
                  <button onClick={() => { setP2pCategory("debt"); setP2pStep("select"); fetchP2PMethods(); }}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 hover:bg-violet-50 transition text-right">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <HandCoins size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">دين عادي</div>
                      <div className="text-[10px] text-gray-400">تسديد دين بينكما</div>
                    </div>
                  </button>
                  <button onClick={() => { setP2pCategory("installment"); fetchP2PInstallments(); }}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 hover:bg-violet-50 transition text-right">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <CalendarClock size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">اقساط</div>
                      <div className="text-[10px] text-gray-400">سداد قسط محدد</div>
                    </div>
                  </button>
                  <button onClick={() => { setP2pCategory("gam3eya"); fetchP2PGam3eya(); }}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 hover:bg-violet-50 transition text-right">
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Users size={16} className="text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">جمعية</div>
                      <div className="text-[10px] text-gray-400">سداد نصيب جمعية</div>
                    </div>
                  </button>
                </div>
              )}

              {/* اختيار القسط/الجمعية */}
              {p2pStep === "items" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-2">
                    {p2pCategory === "installment" ? "اختر القسط:" : "اختر الجمعية:"}
                  </p>
                  {p2pLoading ? (
                    <div className="flex items-center justify-center py-6"><Loader2 size={20} className="animate-spin text-violet-500" /></div>
                  ) : p2pItems.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-400">لا توجد عناصر متاحة</p>
                      <button onClick={() => setP2pStep("category")} className="mt-2 text-xs text-violet-600 font-bold">رجوع</button>
                    </div>
                  ) : (
                    p2pItems.map((item, i) => (
                      <button key={i} onClick={() => { setP2pSelectedItem(item); setP2pAmount(String(item.amount || item.installment_amount || "")); setP2pStep("select"); fetchP2PMethods(); }}
                        className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 hover:bg-violet-50 transition text-right">
                        <div className="flex-1">
                          <div className="text-sm font-bold">{item.amount || item.installment_amount} جنيه</div>
                          {item.is_installment && (
                            <div className="text-[10px] text-gray-400">قسط {(item.paid_installments || 0) + 1}/{item.total_installments}</div>
                          )}
                          {item.description && <div className="text-[10px] text-gray-400">{item.description}</div>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* الخطوة 1: اختيار الوسيلة */}
              {p2pStep === "select" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-2">اختر وسيلة استلام {chatFriend.friend_phone}:</p>
                  {p2pLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-violet-500" /></div>
                  ) : p2pFriendMethods.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-400 mb-3">لا وسائل مشتركة بينكما</p>
                      <p className="text-xs text-gray-300">يجب أن تملكا نفس الوسيلة لتحويل فوري ومجاني</p>
                      <button onClick={() => setShowPaymentMethods(true)} className="mt-3 text-xs text-violet-600 font-bold">سجّل وسائلك</button>
                    </div>
                  ) : (
                    p2pFriendMethods.map((m, i) => (
                      <button key={i} onClick={() => { setP2pSelectedMethod(m); setP2pStep("qr"); }}
                        className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 hover:bg-violet-50 transition text-right">
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <Wallet size={16} className="text-violet-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold">{m.method === "vodafone_cash" ? "فودافون كاش" : m.method === "instapay" ? "إنستاباي" : "أخرى"}</div>
                          <div className="text-xs text-gray-500" dir="ltr">{m.identifier}</div>
                        </div>
                        {m.is_primary && <span className="text-[9px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">رئيسي</span>}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* الخطوة QR: اعرض الكود */}
              {p2pStep === "qr" && p2pSelectedMethod && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-sm font-bold mb-1">
                      {p2pSelectedMethod.method === "vodafone_cash" ? "فودافون كاش" :
                       p2pSelectedMethod.method === "instapay" ? "إنستاباي" :
                       p2pSelectedMethod.method === "etisalat_cash" ? "اتصالات كاش" :
                       p2pSelectedMethod.method === "orange_cash" ? "أورانج كاش" :
                       p2pSelectedMethod.method === "we_cash" ? "وي كاش" :
                       p2pSelectedMethod.method === "bank_account" ? "حساب بنكي" : "بطاقة"}
                    </div>
                    <p className="text-xs text-gray-400">امسح الكود أو انسخ المعرف وحوّل</p>
                  </div>
                  <div className="flex justify-center bg-white p-3 rounded-2xl border border-gray-100">
                    <QRCode value={p2pSelectedMethod.payment_link || p2pSelectedMethod.identifier || p2pSelectedMethod.iban || ""} size={200} />
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                    <code className="flex-1 text-xs text-gray-600 truncate" dir="ltr">
                      {p2pSelectedMethod.identifier || p2pSelectedMethod.iban || ""}
                    </code>
                    <button onClick={() => {
                      navigator.clipboard.writeText(p2pSelectedMethod.identifier || p2pSelectedMethod.iban || "");
                      showToast("تم النسخ");
                    }}
                      className="shrink-0 text-xs text-violet-600 font-bold px-2 py-1 bg-violet-50 rounded-lg">
                      نسخ
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => downloadQR(p2pSelectedMethod.payment_link || p2pSelectedMethod.identifier || "", "payment-qr")}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-xs font-bold">
                      <Download size={14} /> حمل QR
                    </button>
                    <button onClick={() => setP2pStep("amount")}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 text-white rounded-xl py-2.5 text-xs font-bold">
                      متابعة
                    </button>
                  </div>
                </div>
              )}

              {/* الخطوة 2: إدخال المبلغ */}
              {p2pStep === "amount" && p2pSelectedMethod && (
                <div className="space-y-4">
                  <div className="bg-violet-50 rounded-2xl p-3">
                    <div className="text-xs text-gray-500 mb-1">الوسيلة المختارة</div>
                    <div className="text-sm font-bold">{p2pSelectedMethod.method === "vodafone_cash" ? "فودافون كاش" : p2pSelectedMethod.method === "instapay" ? "إنستاباي" : "أخرى"}</div>
                    <div className="text-xs text-gray-600" dir="ltr">{p2pSelectedMethod.identifier}</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">المبلغ (جنيه)</label>
                    <input type="number" value={p2pAmount} onChange={(e) => setP2pAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-100 text-lg font-bold" />
                  </div>
                  <button onClick={initiateP2P} disabled={!p2pAmount || p2pLoading}
                    className="w-full bg-violet-600 text-white rounded-2xl py-3 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                    {p2pLoading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                    ابدأ المعاملة
                  </button>
                  <button onClick={() => setP2pStep("select")} className="w-full text-xs text-gray-400">رجوع</button>
                </div>
              )}

              {/* الخطوة 3: النتيجة */}
              {p2pStep === "done" && p2pResult && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">تم بدء المعاملة ✅</p>
                    <p className="text-xs text-gray-500 mt-1">المبلغ: {p2pAmount} جنيه</p>
                    <p className="text-xs text-gray-500">رقم المعاملة: {p2pResult.id?.slice(0, 8)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-3 text-right">
                    <p className="text-xs text-amber-700 font-medium mb-1">الخطوات التالية:</p>
                    <ol className="text-xs text-amber-600 space-y-1 list-decimal list-inside">
                      <li>حوّل {p2pAmount} جنيه عبر {p2pSelectedMethod.method === "vodafone_cash" ? "فودافون كاش" : p2pSelectedMethod.method === "instapay" ? "إنستاباي" : "الوسيلة المختارة"}</li>
                      <li>إلى: <span dir="ltr">{p2pSelectedMethod.identifier}</span></li>
                      <li>ارفع إيصال التحويل في الشات</li>
                      <li>انتظر تأكيد {chatFriend.friend_phone}</li>
                    </ol>
                  </div>
                  {/* رفع إيصال التحويل */}
                  <input type="file" accept="image/*" onChange={uploadP2PReceipt} className="hidden" ref={receiptInputRef} />
                  <button onClick={() => receiptInputRef?.current?.click()} disabled={p2pReceiptUploading}
                    className="w-full bg-green-600 text-white rounded-2xl py-3 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                    {p2pReceiptUploading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                    ارفع إيصال التحويل
                  </button>
                  <button onClick={() => setChatShowP2P(false)} className="w-full text-xs text-gray-400">أغلق</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* نافذة استرجاع مفتاح التشفير */}
        {showPinUnlock && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <KeyIcon size={20} className="text-[var(--accent)]" />
                <h3 className="font-bold text-lg">رمز الحماية</h3>
              </div>
              <p className="text-sm text-[var(--muted)] mb-4">
                أدخل رمز الحماية لفك تشفير المحادثات. الرمز لا يُخزّن ويُستخدم مرة واحدة فقط.
              </p>
              <input
                type="password"
                value={pinUnlockInput}
                onChange={e => setPinUnlockInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePinUnlock()}
                placeholder="رمز الحماية (4 خانات)"
                maxLength={8}
                autoFocus
                autoComplete="off"
                inputMode="numeric"
                className="w-full border rounded-xl p-3 text-center text-lg tracking-widest mb-3"
                disabled={pinUnlockLoading || unlockWaitMs > 0}
              />
              {pinUnlockErr && <p className="text-red-500 text-sm mb-3">{pinUnlockErr}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setPinUnlockInput(""); setShowPinUnlock(false); }}
                  className="flex-1 py-3 rounded-xl bg-gray-100 font-bold"
                  disabled={pinUnlockLoading}
                >
                  لاحقاً
                </button>
                <button
                  onClick={handlePinUnlock}
                  className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold"
                  disabled={pinUnlockLoading}
                >
                  {pinUnlockLoading ? "جاري..." : "فتح"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showKeyRecovery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowKeyRecovery(false)}>
            <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-center mb-1">استرجاع التشفير</h3>
              <p className="text-xs text-gray-400 text-center mb-4">
                هذا الجهاز لا يملك المفتاح المحلي. أدخل رمزك لاسترجاعه من النسخة السحابية.
              </p>
              <input type="password" value={recoveryPin} onChange={(e) => setRecoveryPin(e.target.value)}
                placeholder="رمز الحماية" maxLength={8}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 mb-3 text-center text-lg tracking-widest" />
              {recoveryErr && <div className="text-red-500 text-sm mb-2 text-center">{recoveryErr}</div>}
              <button onClick={recoverKeyFromCloud} disabled={recoveryLoading}
                className="w-full rounded-2xl bg-[var(--accent)] text-white py-3 font-bold disabled:opacity-50 text-sm">
                {recoveryLoading ? "جاري الاسترجاع..." : "استرجاع المفتاح"}
              </button>
              <button onClick={() => setShowKeyRecovery(false)} className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
            </div>
          </div>
        )}

        {/* نافذة اختيار اللغة */}
        {showLangPicker && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowLangPicker(false)}>
            <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-center mb-1">اختر اللغة</h3>
              <p className="text-xs text-gray-400 text-center mb-4">
                {translateTarget ? "لترجمة الرسالة" : "للسماع والترجمة"}
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {LANGS.map((lng) => (
                  <button key={lng.code}
                    onClick={() => {
                      setSpeakLang(lng.speak);
                      localStorage.setItem("alrafeeq-lang", lng.speak);
                      if (translateTarget) {
                        const msg = messages.find((m) => m.id === translateTarget);
                        if (msg) translateMessage(msg.id, msg.content, lng.code);
                      }
                      setShowLangPicker(false);
                      setTranslateTarget(null);
                    }}
                    className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (speakLang === lng.speak ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                    <span className="text-sm font-bold">{lng.label}</span>
                    {speakLang === lng.speak && <Check size={16} className="text-[var(--accent)] mr-auto" />}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowLangPicker(false); setTranslateTarget(null); }}
                className="w-full text-gray-400 py-2 mt-1 text-sm">إلغاء</button>
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
          <button onClick={() => { setSelectedFriend(null); localStorage.removeItem("alrafeeq-selected-ship"); }}
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

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => { openChat(selectedFriend); setTimeout(() => { setUnifiedCat("debt"); setUnifiedMethod("cash"); setChatShowUnified(true); }, 300); }}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)]">
              <Banknote size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">تسوية</span>
            </button>
            <button onClick={() => openChat(selectedFriend)}
              className="flex flex-col items-center gap-1 bg-white rounded-2xl p-4 border border-[var(--soft)] relative">
              <MessageCircle size={22} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent-dark)]">دردشة</span>
              {selectedFriend && (pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "debtor").length + pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.status === "pending").length) > 0 && (
                <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "debtor").length + pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.status === "pending").length}
                </span>
              )}
            </button>
          </div>

          {/* طلبات تغيير العلاقة المعلّقة */}
          {pendingRelReqs.filter((r) => r.friendship_id === selectedFriend.friendship_id).length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">طلبات تغيير العلاقة</h3>
              {pendingRelReqs.filter((r) => r.friendship_id === selectedFriend.friendship_id).map((r) => (
                <div key={r.id} className="bg-violet-50 rounded-2xl p-3 mb-2 border border-violet-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-bold text-violet-700">
                      طلب أن يصبح: {getRelationLabel(r.requested_role)}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => respondRelReq(r.id, true)}
                        className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 text-xs font-bold flex items-center gap-1">
                        <Check size={14} /> موافق
                      </button>
                      <button onClick={() => respondRelReq(r.id, false)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-400 text-xs font-bold flex items-center gap-1">
                        <X size={14} /> رفض
                      </button>
                    </div>
                  </div>
                  {r.reason && <div className="text-xs text-gray-500">{r.reason}</div>}
                </div>
              ))}
            </div>
          )}

          {/* زر طلب تغيير علاقة */}
          <button onClick={() => { setRelReqShip(selectedFriend.friendship_id); setShowRelReq(true); }}
            className="w-full flex items-center justify-center gap-1.5 bg-violet-50 text-violet-600 rounded-xl py-2.5 text-xs font-bold mb-4">
            <RefreshCw size={14} /> اطلب تغيير العلاقة
          </button>

          {/* طلبات معلّقة لهذا الصديق */}
          {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "debtor").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">طلبات ديون عليك</h3>
              {pendingDebts.filter((d) => d.friend_id === selectedFriend.friend_id && d.you_are === "debtor").map((d) => (
                <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-bold">عليك {d.amount} جنيه</div>
                    <span className="text-xs text-amber-600 font-bold">بانتظار موافقتك</span>
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
              <button onClick={() => openChat(selectedFriend)}
                className="w-full py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold">
                افتح الدردشة للتأكيد
              </button>
            </div>
          )}

          {pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.you_are === "receiver").length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-gray-400 mb-2">تأكيد استلام</h3>
              {pendingSetts.filter((s) => s.friend_id === selectedFriend.friend_id && s.you_are === "receiver").map((s) => (
                <div key={s.id} className="bg-white rounded-2xl p-3 mb-2 border border-[var(--soft)]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-bold">استلمت {s.amount} جنيه</div>
                    <span className="text-xs text-amber-600 font-bold">بانتظار تأكيدك</span>
                  </div>
                </div>
              ))}
              <button onClick={() => openChat(selectedFriend)}
                className="w-full py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold">
                افتح الدردشة للتأكيد
              </button>
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
                  { value: "friend", label: "صديق", paired: "صديق", emoji: "🤝" },
                  { value: "employer", label: "مدير", paired: "يعمل معك", emoji: "💼" },
                  { value: "colleague", label: "أعمل مع", paired: "مديرك", emoji: "👥" },
                  { value: "partner", label: "شريك", paired: "شريك", emoji: "🤝" },
                  { value: "client", label: "عميل", paired: "عميل", emoji: "📋" },
                  { value: "association", label: "جمعية (مدير)", paired: "عضو", emoji: "🔄" },
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
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPaymentMethods(true)}
              className="flex items-center gap-1.5 bg-violet-50 text-violet-600 px-3 py-2 rounded-xl text-sm font-bold">
              <CreditCard size={16} /> وسائل الدفع
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-2 rounded-xl text-sm font-bold">
              <UserPlus size={16} /> أضف صديق
            </button>
          </div>
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
                localStorage.setItem("alrafeeq-selected-ship", f.friendship_id);
                localStorage.removeItem("alrafeeq-chat-ship");
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

      {showPaymentMethods && (
        <PaymentMethodsModal onClose={() => setShowPaymentMethods(false)} />
      )}
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
                { value: "friend", label: "صديق", paired: "صديق", emoji: "🤝" },
                { value: "employer", label: "مدير", paired: "يعمل معك", emoji: "💼" },
                { value: "colleague", label: "أعمل مع", paired: "مديرك", emoji: "👥" },
                { value: "partner", label: "شريك", paired: "شريك", emoji: "🤝" },
                { value: "client", label: "عميل", paired: "عميل", emoji: "📋" },
                { value: "association", label: "جمعية (مدير)", paired: "عضو", emoji: "🔄" },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setRelationType(opt.value)}
                  className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (relationType === opt.value ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                  <span className="text-xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{opt.label}</div>
                    <div className="text-[10px] text-gray-400">الطرف الآخر: {opt.paired}</div>
                  </div>
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

      {/* مودال طلب تغيير العلاقة */}
      {showRelReq && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRelReq(false)}>
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-center mb-1">اطلب تغيير العلاقة</h3>
            <p className="text-xs text-gray-400 text-center mb-4">سيُرسل الطلب للطرف الآخر للموافقة</p>
            <div className="space-y-2 mb-3">
              {[
                { value: "friend", label: "صديق" },
                { value: "employer", label: "مدير" },
                { value: "colleague", label: "أعمل مع" },
                { value: "partner", label: "شريك" },
                { value: "client", label: "عميل" },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setRelReqRole(opt.value)}
                  className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (relReqRole === opt.value ? "border-violet-400 bg-violet-50" : "border-gray-100 bg-gray-50")}>
                  <span className="text-sm font-bold">{opt.label}</span>
                  {relReqRole === opt.value && <Check size={16} className="text-violet-600 mr-auto" />}
                </button>
              ))}
            </div>
            <textarea value={relReqReason} onChange={e => setRelReqReason(e.target.value)}
              placeholder="سبب الطلب (اختياري)" rows={2}
              className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-100 mb-3" />
            <div className="flex gap-2">
              <button onClick={sendRelReq} disabled={!relReqRole || submitting}
                className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40">
                {submitting ? "جاري..." : "إرسال الطلب"}
              </button>
              <button onClick={() => setShowRelReq(false)}
                className="px-4 bg-gray-100 text-gray-500 rounded-xl py-2.5 text-sm font-bold">إلغاء</button>
            </div>
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
                { value: "friend", label: "صديق", paired: "صديق", emoji: "🤝" },
                { value: "employer", label: "مدير", paired: "يعمل معك", emoji: "💼" },
                { value: "colleague", label: "أعمل مع", paired: "مديرك", emoji: "👥" },
                { value: "partner", label: "شريك", paired: "شريك", emoji: "🤝" },
                { value: "client", label: "عميل", paired: "عميل", emoji: "📋" },
                { value: "association", label: "جمعية (مدير)", paired: "عضو", emoji: "🔄" },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setRelationType(opt.value)}
                  className={"w-full flex items-center gap-3 p-3 rounded-2xl border transition " + (relationType === opt.value ? "border-[var(--accent)] bg-green-50" : "border-gray-100 bg-gray-50")}>
                  <span className="text-xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{opt.label}</div>
                    <div className="text-[10px] text-gray-400">الطرف الآخر: {opt.paired}</div>
                  </div>
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
