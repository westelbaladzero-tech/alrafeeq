import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit, getClientId } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// ─── قفل تراكمي للأدمن (أعلى قيمة كهدف) ───
const adminLocks = new Map<string, { until: number; attempts: number }>();
const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_LOCK_MS = 30 * 60 * 1000; // 30 دقيقة (أطول من المستخدم العادي)

function getAdminToken(): string {
  return crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
}

// ─── مقارنة بزمن ثابت: hash القيمتين (طول ثابت دائماً) ───
function safeCompare(input: string, expected: string): boolean {
  const hashA = crypto.createHash("sha256").update(input).digest();
  const hashB = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function POST(req: Request) {
  // ─── Rate limiting: 5 محاولات/دقيقة ───
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("admin-login:" + clientId, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  // ─── تحقق من القفل التراكمي ───
  const lock = adminLocks.get(clientId);
  if (lock && lock.until > Date.now()) {
    const mins = Math.ceil((lock.until - Date.now()) / 60000);
    return NextResponse.json({ error: `تم قفل الدخول — حاول بعد ${mins} دقيقة` }, { status: 423 });
  }

  try {
    const { email, password } = await req.json();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json({ error: "لم يتم إعداد حساب الأدمن بعد" }, { status: 500 });
    }

    // ─── مقارنة بزمن ثابت (hash + timingSafeEqual) ───
    const emailOk = safeCompare(String(email || ""), ADMIN_EMAIL);
    const passOk = safeCompare(String(password || ""), ADMIN_PASSWORD);

    if (!emailOk || !passOk) {
      // ─── زيادة عدّاد المحاولات الفاشلة ───
      const current = adminLocks.get(clientId) || { until: 0, attempts: 0 };
      current.attempts++;
      if (current.attempts >= MAX_ADMIN_ATTEMPTS) {
        current.until = Date.now() + ADMIN_LOCK_MS;
        current.attempts = 0;
        adminLocks.set(clientId, current);
        return NextResponse.json({ error: `محاولات خاطئة كثيرة — قُفل 30 دقيقة` }, { status: 423 });
      }
      adminLocks.set(clientId, current);
      return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 401 });
    }

    // ─── نجاح ← صفّر العدّاد ───
    adminLocks.delete(clientId);

    const token = getAdminToken();
    const res = NextResponse.json({ ok: true, message: "تم تسجيل الدخول" });
    res.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "خطأ في تسجيل الدخول" }, { status: 500 });
  }
}
