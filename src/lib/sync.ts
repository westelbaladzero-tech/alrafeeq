// @ts-nocheck
// نظام المزامنة: طابور عمليات + كاشف اتصال + مزامنة تلقائية

import { getSupabase, isSupabaseEnabled } from "./supabase";
import { KEYS } from "./keys";
import { getResolvedUserId } from "./client-id";

export type OpType = "add_tx" | "delete_tx" | "add_message";

interface QueueItem {
  id: string;
  op: OpType;
  data: any;
  ts: string;
}

// ─── معرف المستخدم ───
async function getUserId(): Promise<string | null> {
  return getResolvedUserId();
}

// ─── الطابور ───
function getQueue(uid: string): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.queue(uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveQueue(uid: string, items: QueueItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEYS.queue(uid), JSON.stringify(items));
  } catch {}
}

export function addToQueue(uid: string, op: OpType, data: any): void {
  const items = getQueue(uid);
  items.push({
    id: `${op}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    op,
    data,
    ts: new Date().toISOString(),
  });
  saveQueue(uid, items);
}

export function getPendingCount(uid: string): number {
  return getQueue(uid).length;
}

// ─── كاشف الاتصال ───
let online = typeof navigator !== "undefined" ? navigator.onLine : true;
const listeners = new Set<(online: boolean, pending: number) => void>();

export function isOnline(): boolean {
  return online;
}

export function onConnectionChange(cb: (online: boolean, pending: number) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// ─── المزامنة ───
export async function syncAll(): Promise<{ uploaded: number; downloaded: number; errors: number }> {
  const uid = await getUserId();
  if (!uid || !online || !isSupabaseEnabled) {
    return { uploaded: 0, downloaded: 0, errors: 0 };
  }

  const sb = getSupabase();
  if (!sb) return { uploaded: 0, downloaded: 0, errors: 0 };

  let uploaded = 0;
  let downloaded = 0;
  let errors = 0;

  // 1) ارفع الطابور
  const queue = getQueue(uid);
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.op === "add_tx") {
        const { error } = await sb.from("transactions").insert({
          id: item.data.localId,
          user_id: uid,
          type: item.data.type,
          amount: item.data.amount,
          category: item.data.category,
          main: item.data.main,
          method: item.data.method,
          note: item.data.note,
        });
        if (error) throw error;
      } else if (item.op === "delete_tx") {
        const { error } = await sb.from("transactions").delete().eq("id", item.data.id);
        if (error) throw error;
      } else if (item.op === "add_message") {
        const { error } = await sb.from("chat_messages").insert({
          user_id: uid,
          role: item.data.role,
          text: item.data.text,
        });
        if (error) throw error;
      }
      uploaded++;
    } catch {
      errors++;
      remaining.push(item);
    }
  }

  saveQueue(uid, remaining);

  // 2) اسحب الجديد من السحابة
  const lastSync = localStorage.getItem(KEYS.lastSync(uid)) || "1970-01-01T00:00:00Z";

  // معاملات جديدة
  try {
    const { data: newTxs } = await sb
      .from("transactions")
      .select("*")
      .eq("user_id", uid)
      .gt("created_at", lastSync)
      .order("created_at", { ascending: false });

    if (newTxs && newTxs.length > 0) {
      const raw = localStorage.getItem(KEYS.transactions(uid));
      let local: any[] = [];
      try { local = raw ? JSON.parse(raw) : []; } catch {}
      const localIds = new Set(local.map((t: any) => t.id));
      for (const tx of newTxs) {
        if (!localIds.has(tx.id)) {
          local.unshift({
            id: tx.id,
            type: tx.type,
            amount: Number(tx.amount),
            category: tx.category,
            main: tx.main,
            method: tx.method,
            note: tx.note || "",
            person: tx.person || "",
            createdAt: tx.created_at,
          });
          downloaded++;
        }
      }
      localStorage.setItem(KEYS.transactions(uid), JSON.stringify(local));
    }
  } catch {}

  // رسائل جديدة
  try {
    const { data: newMsgs } = await sb
      .from("chat_messages")
      .select("*")
      .eq("user_id", uid)
      .gt("created_at", lastSync)
      .order("created_at", { ascending: true });

    if (newMsgs && newMsgs.length > 0) {
      const raw = localStorage.getItem(KEYS.chat(uid));
      let local: any[] = [];
      try { local = raw ? JSON.parse(raw) : []; } catch {}
      const localSigs = new Set(local.map((m: any) => `${m.role}:${m.text}`));
      for (const msg of newMsgs) {
        const sig = `${msg.role}:${msg.text}`;
        if (!localSigs.has(sig)) {
          local.push({ role: msg.role, text: msg.text });
          downloaded++;
        }
      }
      localStorage.setItem(KEYS.chat(uid), JSON.stringify(local));
    }
  } catch {}

  // 3) حدّث آخر مزامنة
  localStorage.setItem(KEYS.lastSync(uid), new Date().toISOString());

  // أبلغ المستمعين
  const pending = remaining.length;
  listeners.forEach(cb => cb(true, pending));

  return { uploaded, downloaded, errors };
}

// ─── التهيئة ───
let initialized = false;

export function initSync() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  window.addEventListener("online", async () => {
    online = true;
    await syncAll();
  });

  window.addEventListener("offline", () => {
    online = false;
    listeners.forEach(cb => cb(false, 0));
  });

  // مزامنة دورية كل 30 ثانية عند الاتصال
  setInterval(() => {
    if (online) syncAll();
  }, 30000);

  // مزامنة فورية عند التحميل لو متصل
  if (online) syncAll();
}
