"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, UserRound, Loader2, Mic, MicOff, Camera, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const STORAGE_KEY = "alrafeeq_chat_history";
const WELCOME = "أهلاً وسهلاً 👋 أنا الرفيق الأمين. قبل ما نبدأ، تحب أناديك بإيه؟";

interface Msg { role: "bot" | "user"; text: string }

async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, `chat-mic-${Date.now()}.webm`);
  const res = await fetch("/api/mic-test", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data?.error || "فشل تفريغ الصوت");
  return data.transcript || "";
}

function getLocalMessages(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getCloudMessages(): Promise<Msg[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data, error } = await sb
    .from("chat_messages")
    .select("role,text,created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  if (error || !data) return null;
  return data.map((row: any) => ({ role: row.role, text: row.text }));
}

async function saveCloudMessage(msg: Msg) {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return false;

  const { error } = await (sb.from("chat_messages") as any).insert({
    user_id: uid,
    role: msg.role,
    text: msg.text,
  });

  return !error;
}

async function saveCloudMessages(msgs: Msg[]) {
  const sb = getSupabase();
  if (!sb || msgs.length === 0) return false;
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return false;

  const rows = msgs.map((msg) => ({
    user_id: uid,
    role: msg.role,
    text: msg.text,
  }));

  const { error } = await (sb.from("chat_messages") as any).insert(rows);
  return !error;
}

export default function ChatView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micSupported] = useState(true);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState("");
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تنظيف الميكروفون عند الخروج
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      const cloudMessages = await getCloudMessages();
      if (cancelled) return;

      if (cloudMessages && cloudMessages.length > 0) {
        setMessages(cloudMessages);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudMessages));
        }
        return;
      }

      const localMessages = getLocalMessages();
      if (localMessages.length > 0) {
        setMessages(localMessages);
        await saveCloudMessages(localMessages);
        return;
      }

      const welcomeMessages = [{ role: "bot" as const, text: WELCOME }];
      setMessages(welcomeMessages);
      await saveCloudMessages(welcomeMessages);
    }

    loadMessages();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || messages.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  async function toggleMic() {
    if (transcribing) return;

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      setInput("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

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
          if (text) setInput(text);
        } catch {
          setInput("");
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage(file);
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImageUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingImage() {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImage(null);
    setPendingImageUrl("");
  }

  async function analyzeReceiptImage(image: File): Promise<string> {
    const formData = new FormData();
    formData.append("image", image);
    const res = await fetch("/api/receipt-test", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || "فشل تحليل الصورة");
    const parts: string[] = [];
    if (data.merchant && data.merchant !== "غير محدد") parts.push(`فاتورة من ${data.merchant}`);
    else parts.push("فاتورة");
    if (data.total && data.total !== "غير محدد") parts.push(`بمبلغ ${data.total} جنيه`);
    if (data.category && data.category !== "غير محدد") parts.push(`تصنيف: ${data.category}`);
    if (data.date && data.date !== "غير محدد") parts.push(`تاريخ: ${data.date}`);
    if (data.items?.length > 0) parts.push(`عناصر: ${data.items.join("، ")}`);
    return parts.join(" - ");
  }

  async function send() {
    if (typing) return;

    let text = input.trim();
    let imageThumb = "";

    if (pendingImage) {
      setAnalyzingImage(true);
      try {
        const receiptText = await analyzeReceiptImage(pendingImage);
        imageThumb = pendingImageUrl;
        text = text ? `${receiptText} - ${text}` : receiptText;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "فشل تحليل الصورة";
        const botMsg = { role: "bot" as const, text: `ما قدرت أحلل الصورة: ${errMsg} 🙏` };
        setMessages(m => [...m, botMsg]);
        await saveCloudMessage(botMsg);
        setAnalyzingImage(false);
        removePendingImage();
        return;
      }
      setAnalyzingImage(false);
      removePendingImage();
    }

    if (!text) return;
    const userMsg = { role: "user" as const, text: imageThumb ? `${text}\n📷 فاتورة` : text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setTyping(true);
    await saveCloudMessage(userMsg);

    try {
      const sb = getSupabase();
      const sessionRes = sb ? await sb.auth.getSession() : null;
      const session = sessionRes?.data?.session || null;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, accessToken: session?.access_token || null, history: newMsgs.slice(-8) }),
      });
      const data = await res.json();
      const botMsg = { role: "bot" as const, text: data.reply || "تمام" };
      setTyping(false);
      setMessages(m => [...m, botMsg]);
      await saveCloudMessage(botMsg);
    } catch {
      const botMsg = { role: "bot" as const, text: "صار خطأ بسيط، جرّب مرة ثانية 🙏" };
      setTyping(false);
      setMessages(m => [...m, botMsg]);
      await saveCloudMessage(botMsg);
    }
  }

  if (messages.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>;
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[var(--soft)] opacity-30 pointer-events-none" />
      <div className="absolute bottom-20 -left-16 w-28 h-28 rounded-full bg-[var(--soft-pink)] opacity-20 pointer-events-none" />

      <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-auto relative">
        {messages.map((m, i) => (
          <div key={i} className={"flex gap-2 " + (m.role === "user" ? "justify-start" : "justify-end")}>
            {m.role === "bot" && (
              <div className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0 shadow-sm">
                <Bot size={16} className="text-[var(--accent)]" />
              </div>
            )}
            <div className={"max-w-[78%] rounded-2xl px-4 py-2.5 whitespace-pre-line text-sm leading-relaxed " +
              (m.role === "user"
                ? "bg-[var(--accent)] text-white rounded-br-md"
                : "bg-white text-[var(--text)] border border-[var(--soft)] rounded-bl-md shadow-sm")}>
              {m.text}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <UserRound size={16} className="text-gray-400" />
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-2 justify-end">
            <div className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0 shadow-sm">
              <Bot size={16} className="text-[var(--accent)]" />
            </div>
            <div className="bg-white border border-[var(--soft)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[var(--soft)] bg-white relative z-10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
          className="hidden"
        />

        {pendingImageUrl && (
          <div className="mb-2 relative inline-block">
            <img src={pendingImageUrl} alt="فاتورة" className="h-20 w-20 object-cover rounded-xl border border-[var(--soft)]" />
            <button
              onClick={removePendingImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {analyzingImage && (
          <div className="mb-2 flex items-center gap-2 text-sm text-violet-600">
            <Loader2 size={16} className="animate-spin" />
            بنحلل الفاتورة...
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* زر الميكرفون */}
          {micSupported && (
            <button onClick={toggleMic}
              disabled={transcribing || typing}
              className={"w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition disabled:opacity-50 " +
                (recording
                  ? "bg-red-500 text-white animate-pulse"
                  : transcribing
                    ? "bg-violet-500 text-white"
                    : "bg-[var(--soft)] text-[var(--accent)]")}>
              {transcribing ? <Loader2 size={18} className="animate-spin" /> : recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          {/* زر الكاميرا */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzingImage || typing || recording}
            className="w-11 h-11 rounded-2xl bg-[var(--soft)] text-[var(--accent)] flex items-center justify-center shrink-0 transition disabled:opacity-50"
          >
            <Camera size={18} />
          </button>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={recording ? "تسجيل... اضغط لإيقاف" : transcribing ? "نفريغ الصوت..." : analyzingImage ? "بنحلل الفاتورة..." : pendingImage ? "أضف ملاحظة أو أرسل مباشرة..." : "اكتب أو انطق مصروفك..."}
            disabled={typing || recording || transcribing || analyzingImage}
            className="flex-1 bg-[var(--bg-warm)] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm disabled:opacity-50" />
          <button onClick={send} disabled={typing || analyzingImage || (!input.trim() && !pendingImage)}
            className="w-11 h-11 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm">
            {typing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
