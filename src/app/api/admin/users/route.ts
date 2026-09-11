import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function verifyAdmin(req: Request): boolean {
  const token = req.headers.get("cookie") || "";
  const match = token.match(/admin_session=([^;]+)/);
  if (!match) return false;
  // ─── hash القيمتين (طول ثابت 32 byte) ثم timingSafeEqual ───
  try {
    const expected = crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
    const inputHash = crypto.createHash("sha256").update(match[1]).digest();
    const expectedHash = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(inputHash, expectedHash);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const rl = await rateLimitDB("admin-users:" + getClientId(req), 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }

  try {
    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

    const { data: profiles } = await admin.from("profiles").select("id, name, email, work_type, created_at").order("created_at", { ascending: false });

    // استعلام واحد لجلب كل user_id (بدل N+1 — يمنع DoS بطيء)
    const { data: txRows } = await admin.from("transactions").select("user_id");
    const countMap: Record<string, number> = {};
    for (const t of txRows || []) {
      if (t.user_id) countMap[t.user_id] = (countMap[t.user_id] || 0) + 1;
    }

    const users = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.name || "غير محدد",
      email: p.email || "",
      work_type: p.work_type || "",
      created_at: p.created_at || "",
      tx_count: countMap[p.id] || 0,
    }));

    return NextResponse.json({ ok: true, users });
  } catch {
    return NextResponse.json({ ok: true, users: [] });
  }
}
