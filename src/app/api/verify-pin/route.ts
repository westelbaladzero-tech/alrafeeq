import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  const { pin, accessToken } = await req.json();
  if (!pin || !accessToken) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const sb = getServerClient();
  if (!sb) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data: { user } } = await sb.auth.getUser(accessToken);
  if (!user || !user.email) {
    return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles")
    .select("pin_hash")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.pin_hash) {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }

  const pinHash = crypto.scryptSync(pin, user.email, 64).toString("hex");

  if (pinHash !== profile.pin_hash) {
    return NextResponse.json({ error: "الرمز خاطئ" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
