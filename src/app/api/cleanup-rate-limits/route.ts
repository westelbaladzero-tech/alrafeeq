import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";

// Cron job: ينظّف سجلات rate_limits القديمة كل ساعة
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });
  }

  const { data, error } = await admin.rpc("cleanup_old_rate_limits");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: data });
}
