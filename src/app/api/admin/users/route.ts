import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function verifyAdmin(req: Request): boolean {
  const token = req.headers.get("cookie") || "";
  const match = token.match(/admin_session=([^;]+)/);
  if (!match) return false;
  const expected = crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
  return match[1] === expected;
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

    const { data: profiles } = await admin.from("profiles").select("*").order("created_at", { ascending: false });

    const users = await Promise.all((profiles || []).map(async (p: any) => {
      const { count } = await admin.from("transactions").select("*", { count: "exact", head: true }).eq("user_id", p.id);
      return {
        id: p.id,
        name: p.name || "غير محدد",
        email: p.email || "",
        work_type: p.work_type || "",
        created_at: p.created_at || "",
        tx_count: count || 0,
      };
    }));

    return NextResponse.json({ ok: true, users });
  } catch {
    return NextResponse.json({ ok: true, users: [] });
  }
}
