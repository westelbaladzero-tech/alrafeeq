import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/validation";

// GET /api/payment-methods — وسائلي المسجّلة
export async function GET(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("pm-get:" + clientId, 20, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = req.headers.get("x-client-id");
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
      .or(`and(user_a.eq.${userId},user_b.eq.${friendId}),and(user_a.eq.${friendId},user_b.eq.${userId})`)
      .limit(1);

    if (!friendship || friendship.length === 0) {
      return NextResponse.json({ error: "هذا ليس صديقك" }, { status: 403 });
    }

    const { data, error } = await admin.from("payment_methods")
      .select("id, method, identifier, display_name, is_primary, payment_link, bank_name, iban, card_type, last_four")
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
  const rl = await rateLimitDB("pm-add:" + clientId, 10, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = req.headers.get("x-client-id");
  if (!userId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { method, identifier, display_name, is_primary, bank_name, iban, card_type, last_four, card_full, payment_link } = await req.json();

  if (!method) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const validMethods = ["vodafone_cash", "instapay", "etisalat_cash", "orange_cash", "we_cash", "bank_account", "card", "other"];
  if (!validMethods.includes(method)) {
    return NextResponse.json({ error: "وسيلة غير مدعومة" }, { status: 400 });
  }

  // امن: لا نقبل الرقم الكامل للبطاقة أو CVV
  if (card_full) {
    return NextResponse.json({ error: "لا ترسل الرقم الكامل — فقط آخر 4 أرقام" }, { status: 400 });
  }

  // تحقق حسب النوع
  const walletMethods = ["vodafone_cash", "etisalat_cash", "orange_cash", "we_cash"];
  if (walletMethods.includes(method) && identifier && !/^01[0-9]{9}$/.test(identifier)) {
    return NextResponse.json({ error: "رقم محفظة غير صحيح (01xxxxxxxxx)" }, { status: 400 });
  }

  if (method === "instapay" && identifier && !identifier.includes("@")) {
    return NextResponse.json({ error: "IPA يجب أن يحتوي على @" }, { status: 400 });
  }

  if (method === "bank_account" && !bank_name) {
    return NextResponse.json({ error: "اسم البنك مطلوب" }, { status: 400 });
  }

  if (method === "card") {
    if (!card_type || !last_four) {
      return NextResponse.json({ error: "نوع البطاقة وآخر 4 أرقام مطلوبان" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(last_four)) {
      return NextResponse.json({ error: "آخر 4 أرقام فقط" }, { status: 400 });
    }
    if (!["visa", "mastercard"].includes(card_type)) {
      return NextResponse.json({ error: "نوع بطاقة غير مدعوم" }, { status: 400 });
    }
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // لو is_primary ← الغِ الـ primary السابق
  if (is_primary) {
    await admin.from("payment_methods")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
  }

  const insertData: Record<string, unknown> = {
    user_id: userId,
    method,
    identifier: identifier ? sanitizeText(identifier, 50) : null,
    display_name: display_name ? sanitizeText(display_name, 50) : null,
    is_primary: !!is_primary,
  };
  if (bank_name) insertData.bank_name = sanitizeText(bank_name, 50);
  if (iban) insertData.iban = sanitizeText(iban, 34);
  if (card_type) insertData.card_type = card_type;
  if (last_four) insertData.last_four = last_four;
  if (payment_link) insertData.payment_link = sanitizeText(payment_link, 200);

  const { data, error } = await admin.from("payment_methods").insert(insertData).select("id").single();

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
  const rl = await rateLimitDB("pm-del:" + clientId, 10, 60);
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const userId = req.headers.get("x-client-id");
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
