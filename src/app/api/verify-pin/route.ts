import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  const { pin, accessToken, userId } = await req.json();
  if (!pin) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }
  if (!accessToken && !userId) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  let userSalt: string | null = null;
  let userUuid: string | null = null;

  // الطريقة 1: لو فيه accessToken، استخدمه
  if (accessToken) {
    try {
      const sb = getServerClient();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser(accessToken);
        if (user && user.email) {
          userSalt = user.email;
          userUuid = user.id;
        }
      }
    } catch {}
  }

  // الطريقة 2: fallback على userId
  if (!userSalt && userId) {
    userUuid = userId;
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.email) {
      userSalt = profile.email;
    }
  }

  if (!userSalt || !userUuid) {
    return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("pin_hash")
    .eq("id", userUuid)
    .maybeSingle();

  if (!profile || !profile.pin_hash) {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }

  const pinHash = crypto.scryptSync(pin, userSalt, 64).toString("hex");

  if (pinHash !== profile.pin_hash) {
    return NextResponse.json({ error: "الرمز خاطئ" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
