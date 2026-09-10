import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { validatePhone } from "@/lib/validation";

const UNIFORM_MESSAGE = "تم إرسال الطلب";
const FIXED_DELAY_MS = 80;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";

  if (!phone || !validatePhone(phone)) {
    return NextResponse.json({ error: "رقم الهاتف غير صحيح" }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
  }

  // طبقة 1: لكل IP
  const clientId = getClientId(req as unknown as Request);
  const rlIp = await rateLimitDB("friend-add:ip:" + clientId, 8, 60);
  if (!rlIp.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const server = getServerClient();
  const admin = getAdminClient();
  if (!server || !admin) {
    return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });
  }

  const { data: { user } } = await server.auth.getUser(accessToken);
  if (!user?.id) {
    return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
  }

  // طبقة 2: لكل مستخدم
  const rlUser = await rateLimitDB("friend-add:user:" + user.id, 8, 60);
  if (!rlUser.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  let friendshipId: string | null = null;

  try {
    // فحص داخلي فقط عبر service_role
    const { data: targetList } = await admin.rpc("find_user_by_phone", { search_phone: phone });
    const target = Array.isArray(targetList) && targetList.length > 0 ? targetList[0] : null;

    if (target && target.id && target.id !== user.id) {
      const { data: existing } = await admin
        .from("friendships")
        .select("id, user_a, user_b, status")
        .or(`and(user_a.eq.${user.id},user_b.eq.${target.id}),and(user_a.eq.${target.id},user_b.eq.${user.id})`)
        .limit(1);

      const already = existing && existing[0];
      if (!already) {
        const { data: inserted } = await admin
          .from("friendships")
          .insert({ user_a: user.id, user_b: target.id, status: "pending", initiator: user.id })
          .select("id")
          .single();
        friendshipId = inserted?.id || null;
      }
    }

    console.info("friend-add attempt", {
      actor: user.id,
      phone_suffix: phone.slice(-4),
      ip: clientId,
      created: !!friendshipId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("friend-add internal error", {
      actor: user.id,
      ip: clientId,
      phone_suffix: phone.slice(-4),
      error,
    });
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < FIXED_DELAY_MS) {
    await sleep(FIXED_DELAY_MS - elapsed);
  }

  // رد موحّد دائماً — بدون كشف وجود الرقم أو التكرار
  return NextResponse.json({ ok: true, message: UNIFORM_MESSAGE });
}
