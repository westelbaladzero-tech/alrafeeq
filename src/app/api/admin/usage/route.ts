import { NextResponse } from "next/server";
import crypto from "crypto";
import { getTodayUsage, getMonthUsage } from "@/lib/usage";

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

  const today = await getTodayUsage();
  const month = await getMonthUsage();

  return NextResponse.json({
    ok: true,
    today: {
      gemini: today.gemini,
      groq: today.groq,
      magic_link: today.magic_link,
      geminiLimit: 1000,
      byEndpoint: today.byEndpoint,
    },
    month: {
      gemini: month.gemini,
      groq: month.groq,
      magic_link: month.magic_link,
    },
  });
}
