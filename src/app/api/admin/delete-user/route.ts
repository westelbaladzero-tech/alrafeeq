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

export async function POST(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

    await admin.from("transactions").delete().eq("user_id", userId);
    await admin.from("chat_messages").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);

    return NextResponse.json({ ok: true, message: "تم حذف الحساب وكل بياناته" });
  } catch {
    return NextResponse.json({ error: "فشل حذف المستخدم" }, { status: 500 });
  }
}
