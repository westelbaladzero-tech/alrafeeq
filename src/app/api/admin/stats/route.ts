import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function verifyAdmin(req: Request): boolean {
  const token = req.headers.get("cookie") || "";
  const match = token.match(/admin_session=([^;]+)/);
  if (!match) return false;
  const expected = crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
  return match[1] === expected;
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
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
