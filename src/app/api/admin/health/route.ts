import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-server";
import { getTodayUsage, getMonthUsage } from "@/lib/usage";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
function verifyAdmin(req: Request): boolean {
  const token = req.headers.get("cookie") || "";
  const match = token.match(/admin_session=([^;]+)/);
  if (!match) return false;
  const expected = crypto.createHash("sha256").update(ADMIN_EMAIL + ADMIN_PASSWORD).digest("hex");
  return match[1] === expected;
}

async function testGemini(): Promise<{ ok: boolean; latency: number; error?: string }> {
  if (!GEMINI_API_KEY) return { ok: false, latency: 0, error: "مفتاح Gemini غير مضبوط" };
  const start = Date.now();
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: GEMINI_MODEL, input: [{ type: "text", text: "OK" }] }),
    });
    const latency = Date.now() - start;
    if (res.ok) return { ok: true, latency };
    const data = await res.json();
    return { ok: false, latency, error: data?.error?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latency: Date.now() - start, error: "فشل الاتصال" };
  }
}

async function testGroq(): Promise<{ ok: boolean; latency: number; error?: string }> {
  if (!GROQ_KEY) return { ok: false, latency: 0, error: "مفتاح Groq غير مضبوط" };
  const start = Date.now();
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: "OK" }], max_tokens: 1 }),
    });
    const latency = Date.now() - start;
    if (res.ok) return { ok: true, latency };
    return { ok: false, latency, error: `HTTP ${res.status}` };
  } catch {
    return { ok: false, latency: Date.now() - start, error: "فشل الاتصال" };
  }
}

async function testSMTP(): Promise<{ ok: boolean; latency: number; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, latency: 0, error: "إعدادات Supabase غير مكتملة" };
  }
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    const latency = Date.now() - start;
    if (res.ok) return { ok: true, latency };
    return { ok: false, latency, error: `Supabase Auth: HTTP ${res.status}` };
  } catch {
    return { ok: false, latency: Date.now() - start, error: "فشل الاتصال بـ Supabase Auth" };
  }
}

async function testSupabase(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, latency: 0, error: "Admin client غير متاح" };
    const { error } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    const latency = Date.now() - start;
    if (error) return { ok: false, latency, error: error.message };
    return { ok: true, latency };
  } catch (e) {
    return { ok: false, latency: Date.now() - start, error: "فشل الاتصال" };
  }
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const [gemini, groq, smtp, supabase, today, month] = await Promise.all([
    testGemini(),
    testGroq(),
    testSMTP(),
    testSupabase(),
    getTodayUsage(),
    getMonthUsage(),
  ]);

  return NextResponse.json({
    ok: true,
    services: {
      gemini: { ...gemini, today: today.gemini, month: month.gemini, limit: 1000 },
      groq: { ...groq, today: today.groq, month: month.groq, limit: 1000 },
      smtp: { ...smtp, today: today.magic_link, month: month.magic_link, limit: 200 },
      supabase: { ...supabase, today: 0, month: 0, limit: 0 },
    },
    endpoints: today.byEndpoint,
  });
}
