import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/validation";
import { getAuthUserId } from "@/lib/auth-server";

// GET /api/relationship-change — طلباتي المعلّقة
export async function GET(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("rcr-get:" + clientId, 20, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // اجلب الطلبات في صداقاتي
  const { data: myShips } = await admin.from("friendships")
    .select("id").or(`user_a.eq.${userId},user_b.eq.${userId}`);

  const shipIds = (myShips || []).map((s: any) => s.id);
  if (shipIds.length === 0) return NextResponse.json({ ok: true, requests: [] });

  const { data, error } = await admin.from("relationship_change_requests")
    .select("*").in("friendship_id", shipIds).eq("status", "pending").order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "تعذّر الجلب" }, { status: 500 });
  return NextResponse.json({ ok: true, requests: data || [] });
}

// POST /api/relationship-change — إرسال طلب تغيير
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("rcr-send:" + clientId, 5, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { friendship_id, requested_role, reason } = await req.json();
  if (!friendship_id || !requested_role) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const validRoles = ["friend", "employer", "colleague", "partner", "client", "association", "member"];
  if (!validRoles.includes(requested_role)) {
    return NextResponse.json({ error: "دور غير صحيح" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق أن المستخدم طرف في الصداقة
  const { data: ship } = await admin.from("friendships")
    .select("id, user_a, user_b, role_a, role_b, relationship_type")
    .eq("id", friendship_id).single();

  if (!ship) return NextResponse.json({ error: "صداقة غير موجودة" }, { status: 404 });

  if (ship.user_a !== userId && ship.user_b !== userId) {
    return NextResponse.json({ error: "لست طرفاً في هذه الصداقة" }, { status: 403 });
  }

  // حدّد دورك الحالي
  const myCurrentRole = ship.user_a === userId ? (ship.role_a || ship.relationship_type) : (ship.role_b || ship.relationship_type);

  // أنشئ الطلب
  const { data, error } = await admin.from("relationship_change_requests").insert({
    friendship_id,
    requester_id: userId,
    requested_role,
    previous_role: myCurrentRole,
    reason: reason ? sanitizeText(reason, 200) : null,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "لديك طلب معلّق بالفعل" }, { status: 409 });
    return NextResponse.json({ error: "تعذّر الإرسال" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

// PATCH /api/relationship-change — موافقة/رفض
export async function PATCH(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("rcr-res:" + clientId, 10, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { request_id, approved } = await req.json();
  if (!request_id) return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data: reqData } = await admin.from("relationship_change_requests")
    .select("*").eq("id", request_id).single();

  if (!reqData) return NextResponse.json({ error: "طلب غير موجود" }, { status: 404 });

  // تحقق أن المستخدم هو الطرف الآخر (غير المُرسل)
  const { data: ship } = await admin.from("friendships")
    .select("user_a, user_b").eq("id", reqData.friendship_id).single();

  if (!ship) return NextResponse.json({ error: "صداقة غير موجودة" }, { status: 404 });

  if (reqData.requester_id === userId) {
    return NextResponse.json({ error: "لا يمكنك الموافقة على طلبك" }, { status: 403 });
  }

  if (ship.user_a !== userId && ship.user_b !== userId) {
    return NextResponse.json({ error: "لست طرفاً" }, { status: 403 });
  }

  // حدّث الطلب
  await admin.from("relationship_change_requests")
    .update({ status: approved ? "approved" : "rejected", resolved_at: new Date().toISOString() })
    .eq("id", request_id);

  // لو موافقة ← طبّق التغيير
  if (approved) {
    const newRole = reqData.requested_role;
    const pairedRole = getPairedRole(newRole);
    const isRequesterA = ship.user_a === reqData.requester_id;
    await admin.from("friendships").update({
      relationship_type: newRole,
      role_a: isRequesterA ? newRole : pairedRole,
      role_b: isRequesterA ? pairedRole : newRole,
    }).eq("id", reqData.friendship_id);
  }

  return NextResponse.json({ ok: true, approved });
}

function getPairedRole(role: string): string {
  const pairs: Record<string, string> = {
    employer: "colleague",
    colleague: "employer",
    partner: "partner",
    association: "member",
    member: "association",
    friend: "friend",
    client: "client",
  };
  return pairs[role] || "friend";
}
