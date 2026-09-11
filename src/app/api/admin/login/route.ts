import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// ─── قفل تراكمي للأدمن عبر rateLimitDB (مشترك بين instances) ───
const MAX_ADMIN_ATTEMPTS = 5;

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
  // ─── قراءة البيانات أولاً ───
  const { email, password } = await req.json().catch(() => ({}));

  // ─── طبقة 1: Rate limiting على مستوى IP (5/دقيقة) ───
  const clientId = getClientId(req as unknown as Request);
  const rlIp = await rateLimitDB("admin-login:ip:" + clientId, 5, 60, true);
  if (!rlIp.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  // ─── طبقة 2: Rate limiting على مستوى الإيميل (5/دقيقة) ───
  // يحمي من IP rotation على حساب الأدمن
  if (email) {
    const rlEmail = await rateLimitDB("admin-login:email:" + email, 5, 60, true);
    if (!rlEmail.allowed) {
      return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
    }
  }

  // ─── طبقة 3: قفل تراكمي عبر rateLimitDB (مشترك بين instances) ───
  const rlLock = await rateLimitDB("admin-lock:" + clientId, MAX_ADMIN_ATTEMPTS, 1800, true); // 5 محاولات / 30 دقيقة
  if (!rlLock.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — قُفل 30 دقيقة" }, { status: 423 });
  }

  try {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json({ error: "لم يتم إعداد حساب الأدمن بعد" }, { status: 500 });
    }

    // ─── مقارنة بزمن ثابت (hash + timingSafeEqual) ───
    const emailOk = safeCompare(String(email || ""), ADMIN_EMAIL);
    const passOk = safeCompare(String(password || ""), ADMIN_PASSWORD);

    if (!emailOk || !passOk) {
      return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 401 });
    }


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
