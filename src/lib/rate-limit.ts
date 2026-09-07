// ─── تحديد المعدل (Rate Limiting) ───
// منع الإساءة بإبقاء سجل في الذاكرة

interface RateEntry {
  count: number;
  resetAt: number;
}

const store: Map<string, RateEntry> = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 دقائق

// نظّف السجلات القديمة دورياً
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, CLEANUP_INTERVAL).unref?.();

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
