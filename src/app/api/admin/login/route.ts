import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit, getClientId } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function getAdminToken(): string {
  return crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
}

export async function POST(req: Request) {
  // ─── Rate limiting: 5 محاولات/دقيقة ───
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("admin-login:" + clientId, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  try {
    const { email, password } = await req.json();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json({ error: "لم يتم إعداد حساب الأدمن بعد" }, { status: 500 });
    }

    // ─── مقارنة بزمن ثابت (منع timing attack) ───
    const emailOk = email === ADMIN_EMAIL;
    const passOk = crypto.timingSafeEqual(
      Buffer.from(String(password)),
      Buffer.from(String(ADMIN_PASSWORD).padEnd(String(password).length, "\0"))
    );
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
