import { NextResponse } from "next/server";
import crypto from "crypto";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function getAdminToken(): string {
  return crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json({ error: "لم يتم إعداد حساب الأدمن بعد" }, { status: 500 });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
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
