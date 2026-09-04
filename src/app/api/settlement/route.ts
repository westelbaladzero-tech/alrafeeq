import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { from_user, to_user, friendship_id, amount, description, status } = await req.json();
  
  if (!from_user || !to_user || !friendship_id || !amount) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  const { data, error } = await admin.from("settlements").insert({
    from_user,
    to_user,
    friendship_id,
    amount,
    description: description || null,
    status: status || "pending",
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: "تعذّر إرسال التسوية" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
