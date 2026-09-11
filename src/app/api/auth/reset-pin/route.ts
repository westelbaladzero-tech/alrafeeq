import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { validatePin } from "@/lib/validation";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  // ─── Rate limiting (5/دقيقة لكل IP) ───
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("reset-pin:ip:" + clientId, 5, 60, true);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const { pin, accessToken } = await req.json().catch(() => ({}));
  if (!pin || !validatePin(pin)) {
    return NextResponse.json({ error: "الرمز يجب أن يكون 4 خانات على الأقل" }, { status: 400 });
  }

  const admin = getAdminClient();
  const sb = getServerClient();
  if (!admin || !sb) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  if (!accessToken) {
    return NextResponse.json({ error: "لم يتم تأكيد الإيميل" }, { status: 401 });
  }

  const { data: { user } } = await sb.auth.getUser(accessToken);
  if (!user || !user.email) {
    return NextResponse.json({ error: "لم يتم تأكيد الإيميل" }, { status: 401 });
  }

  const pinHash = crypto.scryptSync(pin, user.email, 64).toString("hex");

  const { error } = await admin.from("profiles")
    .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null })
    .eq("email", user.email);

  if (error) return NextResponse.json({ error: "تعذر تحديث الرمز" }, { status: 500 });
  return NextResponse.json({ ok: true, message: "تم تحديث الرمز بنجاح" });
}
