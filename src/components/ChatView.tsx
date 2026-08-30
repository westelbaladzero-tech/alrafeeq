"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, UserRound, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const WELCOME = "أهلاً وسهلاً 👋 أنا الرفيق — قوللي أي شي صرفته أو أي دخل وصلك وأنا أسجّله وأفكرك برصيدك.";

interface Msg { role: "bot" | "user"; text: string }

export default function ChatView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([{ role: "bot", text: WELCOME }]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

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
        body: JSON.stringify({
          message: text,
          accessToken: session?.access_token || null,
          history: newMsgs.slice(-5),
        }),
      });
      const data = await res.json();
      setTyping(false);
      setMessages(m => [...m, { role: "bot", text: data.reply || "تمام" }]);
    } catch {
      setTyping(false);
      setMessages(m => [...m, { role: "bot", text: "صار خطأ بسيط، جرّب مرة ثانية 🙏" }]);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-auto">
        {messages.map((m, i) => (
          <div key={i} className={"flex gap-2 " + (m.role === "user" ? "justify-start" : "justify-end")}>
            {m.role === "bot" && (
              <div className="w-9 h-9 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
            )}
            <div className={"max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-line " + (m.role === "user" ? "bg-gray-100" : "bg-[var(--soft)]")}>
              {m.text}
            </div>
            {m.role === "user" && (
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <UserRound size={18} />
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-2 justify-end">
            <div className="w-9 h-9 rounded-full bg-[var(--soft)] flex items-center justify-center shrink-0">
              <Bot size={18} />
            </div>
            <div className="bg-[var(--soft)] rounded-2xl px-4 py-3 flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="اكتب مصروفك أو سؤالك..."
            disabled={typing}
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 disabled:opacity-50" />
          <button onClick={send} disabled={typing || !input.trim()}
            className="w-12 h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 disabled:opacity-50">
            {typing ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
      </div>
    </div>
  );
}
