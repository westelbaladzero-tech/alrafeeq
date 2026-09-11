import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function verifyAdmin(req: Request): boolean {
  const token = req.headers.get("cookie") || "";
  const match = token.match(/admin_session=([^;]+)/);
  if (!match) return false;
  // ─── hash القيمتين (طول ثابت 32 byte) ثم timingSafeEqual ───
  try {
    const expected = crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
    const inputHash = crypto.createHash("sha256").update(match[1]).digest();
    const expectedHash = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(inputHash, expectedHash);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const rl = await rateLimitDB("admin-stats:" + getClientId(req), 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  try {
    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

    const { count: userCount } = await admin.from("profiles").select("*", { count: "exact", head: true });
    const { count: txCount } = await admin.from("transactions").select("*", { count: "exact", head: true });
    const { count: msgCount } = await admin.from("chat_messages").select("*", { count: "exact", head: true });

    return NextResponse.json({
      ok: true,
      users: userCount || 0,
      transactions: txCount || 0,
      messages: msgCount || 0,
    });
  } catch {
    return NextResponse.json({ ok: true, users: 0, transactions: 0, messages: 0 });
  }
}
