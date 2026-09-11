import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-server";

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

export async function POST(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });

    // ─── تحقق من إن userId هو UUID صالح (منع SQL injection في .or()) ───
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(userId))) {
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

    // احذف كل البيانات المالية والشخصية
    await admin.from("sanad_records").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await admin.from("p2p_transactions").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await admin.from("settlements").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await admin.from("debt_requests").delete().or(`creditor.eq.${userId},debtor.eq.${userId}`);
    await admin.from("gam3eya_turns").delete().eq("user_id", userId);
    await admin.from("messages").delete().or(`sender_id.eq.${userId}`);
    await admin.from("friendships").delete().or(`user_a.eq.${userId},user_b.eq.${userId}`);
    await admin.from("payment_methods").delete().eq("user_id", userId);
    await admin.from("relationship_change_requests").delete().eq("requester_id", userId);
    await admin.from("transactions").delete().eq("user_id", userId);
    await admin.from("chat_messages").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);

    return NextResponse.json({ ok: true, message: "تم حذف الحساب وكل بياناته" });
  } catch {
    return NextResponse.json({ error: "فشل حذف المستخدم" }, { status: 500 });
  }
}
