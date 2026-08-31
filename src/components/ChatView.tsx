"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, UserRound, Loader2, Mic, MicOff } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const STORAGE_KEY = "alrafeeq_chat_history";
const WELCOME = "أهلاً وسهلاً 👋 أنا الرفيق الأمين. قبل ما نبدأ، تحب أناديك بإيه؟";

interface Msg { role: "bot" | "user"; text: string }

export default function ChatView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  // فحص دعم الميكرفون
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    setMicSupported(true);
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      finalTranscriptRef.current = "";
      setListening(true);
    };

    rec.onresult = (e: any) => {
      let finalText = finalTranscriptRef.current;
      let interimText = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i]?.[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (e.results[i].isFinal) finalText += (finalText ? " " : "") + transcript;
        else interimText += (interimText ? " " : "") + transcript;
      }

      finalTranscriptRef.current = finalText;
      const nextText = (finalText || interimText).trim();
      if (nextText) setInput(nextText);
    };

    rec.onend = () => {
      setListening(false);
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) setInput(finalText);
    };

    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;

    return () => {
      try { rec.stop(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) { setMessages(parsed); return; }
      }
    } catch {}
    setMessages([{ role: "bot", text: WELCOME }]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || messages.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (listening) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
      return;
    }

    finalTranscriptRef.current = "";
    setInput("");
    try {
      recognitionRef.current.start();
    } catch {}
  }

  async function send() {
    if (!input.trim() || typing) return;
    const text = input.trim();
    const newMsgs = [...messages, { role: "user" as const, text }];
    setMessages(newMsgs);
    setInput("");
    setTyping(true);

    try {
      const sb = getSupabase();
      const { data: { session } } = await sb!.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, accessToken: session?.access_token || null, history: newMsgs.slice(-8) }),
      });
      const data = await res.json();
      setTyping(false);
      setMessages(m => [...m, { role: "bot", text: data.reply || "تمام" }]);
    } catch {
      setTyping(false);
      setMessages(m => [...m, { role: "bot", text: "صار خطأ بسيط، جرّب مرة ثانية 🙏" }]);
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
        <div className="flex gap-2 items-end">
          {/* زر الميكرفون */}
          {micSupported && (
            <button onClick={toggleMic}
              className={"w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition " +
                (listening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-[var(--soft)] text-[var(--accent)]")}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={listening ? "استمع..." : "اكتب أو انطق مصروفك..."}
            disabled={typing}
            className="flex-1 bg-[var(--bg-warm)] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--soft)] text-sm disabled:opacity-50" />
          <button onClick={send} disabled={typing || !input.trim()}
            className="w-11 h-11 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm">
            {typing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
