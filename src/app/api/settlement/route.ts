import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimit, getClientId } from "@/lib/rate-limit";
import { validateAmount, sanitizeText } from "@/lib/validation";

export async function POST(req: NextRequest) {
  // ─── Rate limiting: 10 طلبات/دقيقة ───
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("sett:" + clientId, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  const { from_user, to_user, friendship_id, amount, description, status } = await req.json();
  
  if (!from_user || !to_user || !friendship_id || !amount) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  // ─── تحقق من المبلغ ───
  const amt = validateAmount(amount);
  if (!amt.ok) {
    return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data, error } = await admin.from("settlements").insert({
    from_user,
    to_user,
    friendship_id,
    amount: amt.value,
    description: description ? sanitizeText(description, 200) : null,
    status: status || "pending",
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: "تعذّر إرسال التسوية" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
