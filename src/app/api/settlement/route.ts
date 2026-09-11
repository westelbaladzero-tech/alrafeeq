import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { validateAmount, sanitizeText } from "@/lib/validation";
import { logFinancialEvent } from "@/lib/audit-log";
import { getAuthUserId } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  // ─── Rate limiting: 10 طلبات/دقيقة ───
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("sett:" + clientId, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  // ─── تحقق من هوية المستخدم ───
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { to_user, friendship_id, amount, description, linked_debt_id, status, category } = await req.json();

  if (!to_user || !friendship_id || !amount) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  // ─── تحقق من المبلغ ───
  const amt = validateAmount(amount);
  if (!amt.ok) {
    return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // ─── تحقق من الصداقة: المستخدم يجب أن يكون طرفاً فيها ───
  const { data: ship } = await admin.from("friendships")
    .select("id, user_a, user_b")
    .eq("id", friendship_id)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .limit(1);
  if (!ship || ship.length === 0) {
    return NextResponse.json({ error: "غير مصرّح — هذه ليست صداقتك" }, { status: 403 });
  }

  // تحقق من إن to_user هو الطرف الآخر في الصداقة
  const friendship = ship[0];
  const otherParty = friendship.user_a === userId ? friendship.user_b : friendship.user_a;
  if (to_user !== otherParty) {
    return NextResponse.json({ error: "to_user يجب أن يكون الطرف الآخر في الصداقة" }, { status: 400 });
  }

  // ─── from_user = المستخدم المصادق عليه دائماً ───
  const { data, error } = await admin.from("settlements").insert({
    from_user: userId,
    to_user,
    friendship_id,
    amount: amt.value,
    description: description ? sanitizeText(description, 200) : null,
    category: category || "debt",
    linked_debt_id: linked_debt_id || null,
    status: "confirmed",  // تجاهل status من العميل — التسوية موثّقة عند الإنشاء
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: "تعذّر إرسال التسوية" }, { status: 500 });
  }

  await logFinancialEvent({
    eventType: "settlement_created",
    actorId: userId,
    targetUserId: to_user,
    entityType: "settlement",
    entityId: data.id,
    amount: amt.value,
    metadata: { linked_debt_id, status: status || "pending" },
    req: req as unknown as Request,
  });

  return NextResponse.json({ ok: true, id: data?.id });
}
