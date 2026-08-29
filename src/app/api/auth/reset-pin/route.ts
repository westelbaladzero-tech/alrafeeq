import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  const { pin, accessToken } = await req.json();
  if (!pin || pin.length < 4) {
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
