import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { getAuthUserId } from "@/lib/auth-server";
import { validateAmount } from "@/lib/validation";

// GET /api/sanad?friendship_id=X ← سندات الصداقة
// GET /api/sanad?debt_id=X ← سندات دين محدد
// GET /api/sanad?category=gam3eya ← سندات جمعية
export async function GET(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("sanad-get:" + clientId, 30, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const friendshipId = searchParams.get("friendship_id");
  const debtId = searchParams.get("debt_id");
  const category = searchParams.get("category");

  // تحقق من الصداقة
  if (friendshipId) {
    const { data: ship } = await admin.from("friendships")
      .select("id").eq("id", friendshipId)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`).limit(1);
    if (!ship || ship.length === 0) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
    }
  }

  let query = admin.from("sanad_records").select("*").order("created_at", { ascending: false });

  if (friendshipId) {
    query = query.eq("friendship_id", friendshipId);
  } else {
    // كل صداقاتي
    const { data: myShips } = await admin.from("friendships")
      .select("id").or(`user_a.eq.${userId},user_b.eq.${userId}`);
    const shipIds = (myShips || []).map((s: any) => s.id);
    if (shipIds.length === 0) return NextResponse.json({ ok: true, sanads: [] });
    query = query.in("friendship_id", shipIds);
  }

  if (debtId) query = query.eq("linked_debt_id", debtId);
  if (category) query = query.eq("category", category);

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: "تعذّر الجلب" }, { status: 500 });
  return NextResponse.json({ ok: true, sanads: data || [] });
}

// POST /api/sanad — إنشاء سند جديد
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("sanad-create:" + clientId, 10, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { friendship_id, type, category, to_user, amount, description, linked_debt_id, linked_settlement_id, linked_p2p_id, payment_method, receipt_url, status } = await req.json();

  if (!friendship_id || !type || !category || !to_user || !amount) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق من الصداقة
  const { data: ship } = await admin.from("friendships")
    .select("id, user_a, user_b").eq("id", friendship_id).single();
  if (!ship) return NextResponse.json({ error: "صداقة غير موجودة" }, { status: 404 });
  if (ship.user_a !== userId && ship.user_b !== userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  // تحقق من إن to_user هو الطرف الآخر في الصداقة
  const otherParty = ship.user_a === userId ? ship.user_b : ship.user_a;
  if (to_user !== otherParty) {
    return NextResponse.json({ error: "to_user يجب أن يكون الطرف الآخر في الصداقة" }, { status: 400 });
  }

  // تحقق من المبلغ
  const amt = validateAmount(amount);
  if (!amt.ok) return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });

  // احسب رقم السند التالي ذرّياً (RPC يمنع race condition)
  const { data: rpcResult } = await admin.rpc("get_next_sanad_number", { f_ship_id: friendship_id });
  const sanadNumber = rpcResult || 1;

  const { data, error } = await admin.from("sanad_records").insert({
    friendship_id,
    type,
    category,
    from_user: userId,
    to_user,
    amount: amt.value,
    description: description || null,
    linked_debt_id: linked_debt_id || null,
    linked_settlement_id: linked_settlement_id || null,
    linked_p2p_id: linked_p2p_id || null,
    payment_method: payment_method || null,
    receipt_url: receipt_url || null,
    status: "pending",  // تجاهل status من العميل — الطرف الآخر يؤكد
    sanad_number: sanadNumber,
    confirmed_at: null,
  }).select("id, sanad_number").single();

  if (error) return NextResponse.json({ error: "تعذّر الإنشاء" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id, sanad_number: data?.sanad_number });
}
