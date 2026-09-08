import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimit, getClientId } from "@/lib/rate-limit";
import { getUserIdSync } from "@/lib/client-id";
import { sanitizeText } from "@/lib/validation";

// GET /api/payment-methods — وسائلي المسجّلة
export async function GET(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("pm-get:" + clientId, 20, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = getUserIdSync();
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // لو فيه friend_id ← اجلب وسائل الصديق (بعد التحقق)
  const { searchParams } = new URL(req.url);
  const friendId = searchParams.get("friend_id");

  if (friendId) {
    // تحقق من الصداقة
    const { data: friendship } = await admin.from("friendships")
      .select("id")
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .limit(1);

    if (!friendship || friendship.length === 0) {
      return NextResponse.json({ error: "هذا ليس صديقك" }, { status: 403 });
    }

    const { data, error } = await admin.from("payment_methods")
      .select("id, method, identifier, display_name, is_primary")
      .eq("user_id", friendId)
      .eq("is_active", true)
      .order("is_primary", { ascending: false });

    if (error) return NextResponse.json({ error: "تعذّر الجلب" }, { status: 500 });

    return NextResponse.json({ ok: true, methods: data || [] });
  }

  // وسائلي أنا
  const { data, error } = await admin.from("payment_methods")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false });

  if (error) return NextResponse.json({ error: "تعذّر الجلب" }, { status: 500 });

  return NextResponse.json({ ok: true, methods: data || [] });
}

// POST /api/payment-methods — إضافة وسيلة دفع
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("pm-add:" + clientId, 10, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = getUserIdSync();
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { method, identifier, display_name, is_primary } = await req.json();

  if (!method || !identifier) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  if (!["vodafone_cash", "instapay", "other"].includes(method)) {
    return NextResponse.json({ error: "وسيلة غير مدعومة" }, { status: 400 });
  }

  // تحقق من تنسيق المعرف
  if (method === "vodafone_cash" && !/^01[0-9]{9}$/.test(identifier)) {
    return NextResponse.json({ error: "رقم فودافون غير صحيح (01xxxxxxxxx)" }, { status: 400 });
  }

  if (method === "instapay" && !identifier.includes("@")) {
    return NextResponse.json({ error: "IPA يجب أن يحتوي على @" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // لو is_primary ← ألغِ الـ primary السابق
  if (is_primary) {
    await admin.from("payment_methods")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
  }

  const { data, error } = await admin.from("payment_methods").insert({
    user_id: userId,
    method,
    identifier: sanitizeText(identifier, 50),
    display_name: display_name ? sanitizeText(display_name, 50) : null,
    is_primary: !!is_primary,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "هذه الوسيلة مسجّلة بالفعل" }, { status: 409 });
    }
    return NextResponse.json({ error: "تعذّر الإضافة" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

// DELETE /api/payment-methods — حذف وسيلة
export async function DELETE(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("pm-del:" + clientId, 10, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = getUserIdSync();
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { error } = await admin.from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "تعذّر الحذف" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
