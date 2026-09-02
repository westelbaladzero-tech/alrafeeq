// @ts-nocheck
// إدارة معرف العميل (client_id) — معرف فريد لكل مستخدم
// يُنشأ عند إنشاء الحساب، يلازمه في المحلي والحساب

import { KEYS } from "./keys";
import { getSupabase, isSupabaseEnabled } from "./supabase";

// ─── قراءة متزامنة من localStorage ───

export function getClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEYS.clientId);
  } catch {
    return null;
  }
}

export function getUserIdSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEYS.userId);
  } catch {
    return null;
  }
}

// ─── توليد معرف جديد ───

export function generateClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cid_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ─── ضمان وجود معرف — يولّد إن لم يجد ───

export function ensureClientId(): string {
  if (typeof window === "undefined") return generateClientId();
  let cid = getClientId();
  if (!cid) {
    cid = generateClientId();
    try {
      localStorage.setItem(KEYS.clientId, cid);
    } catch {}
  }
  return cid;
}

// ─── حفظ المعرفين محليًا ───

export function setLocalIds(clientId: string, userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEYS.clientId, clientId);
    localStorage.setItem(KEYS.userId, userId);
  } catch {}
}

// ─── جلب معرف المستخدم (متزامن أولًا، ثم السحابة) ───

export async function getResolvedUserId(): Promise<string | null> {
  const cached = getUserIdSync();
  if (cached) return cached;

  if (!isSupabaseEnabled) return null;
  const sb = getSupabase();
  if (!sb) return null;

  const { data } = await sb.auth.getUser();
  const uid = data.user?.id || null;

  if (uid && typeof window !== "undefined") {
    try {
      localStorage.setItem(KEYS.userId, uid);
    } catch {}
  }

  return uid;
}

// ─── مزامنة client_id من السحابة (عند الدخول من جهاز جديد) ───

export async function syncClientIdFromCloud(): Promise<string | null> {
  const uid = await getResolvedUserId();
  if (!uid || !isSupabaseEnabled) return getClientId();

  const sb = getSupabase();
  if (!sb) return getClientId();

  try {
    const { data } = await sb
      .from("profiles")
      .select("client_id")
      .eq("id", uid)
      .maybeSingle();

    if (data?.client_id) {
      if (typeof window !== "undefined") {
        localStorage.setItem(KEYS.clientId, data.client_id);
        localStorage.setItem(KEYS.userId, uid);
      }
      return data.client_id;
    }
  } catch {}

  return ensureClientId();
}
