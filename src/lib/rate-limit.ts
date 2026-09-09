// ─── تحديد المعدل (Rate Limiting) ───
// طبقتان: in-memory (سريع) + Supabase (shared بين instances)

import { getAdminClient } from "./supabase-server";

interface RateEntry {
  count: number;
  resetAt: number;
}

const store: Map<string, RateEntry> = new Map();

// ─── Rate limiting عبر قاعدة البيانات (يعمل بين كل instances) ───
export async function rateLimitDB(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const admin = getAdminClient();
  if (!admin) {
    // fallback لـ in-memory لو ما فيه admin client
    return rateLimit(identifier, limit, windowSeconds * 1000);
  }

  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    p_key: identifier,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("rateLimitDB error:", error);
    // fail open — خلّي الطلب يمر (أفضل من حظر المستخدمين الشرعيين)
    return { allowed: true, remaining: limit - 1 };
  }

  const count = data as number;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

// ─── in-memory rate limiting (fallback / سريع للمسارات غير الحرجة) ───
export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// احصل على معرّف العميل من الطلب
export function getClientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
