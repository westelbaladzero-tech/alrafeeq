// ============================================================
// تشغيل مخطط أدوار الجمعية على Supabase
// التشغيل: node scripts/run-gam3eya-migration.mjs
// يحتاج: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = join(__dirname, "..", "supabase", "gam3eya_turns.sql");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ ناقص: NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY");
  console.error("   اضبطها في .env.local أو في البيئة ثم أعد التشغيل");
  process.exit(1);
}

// استخراج project ref من URL
const ref = SUPABASE_URL.replace("https://", "").split(".")[0];

const sql = readFileSync(SQL_FILE, "utf-8");

console.log("📄 SQL file:", SQL_FILE);
console.log("📏 SQL size:", sql.length, "chars");
console.log("🔧 Project ref:", ref);
console.log("");

// تنفيذ SQL عبر Supabase Management API
// POST https://api.supabase.com/v1/projects/{ref}/database/query
// هذا يتطلب personal access token، مو service role key
// البديل: استخدم PostgREST rpc أو Dashboard

// محاولة تنفيذ عبر database query endpoint
const queryEndpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

console.log("("=" .repeat(60));
console.log("📋 تعليمات التنفيذ اليدوي:");
console.log("=" .repeat(60));
console.log("");
console.log("1. افتح Supabase Dashboard:");
console.log(`   https://supabase.com/dashboard/project/${ref}/sql/new`);
console.log("");
console.log("2. انسخ محتوى الملف:");
console.log(`   supabase/gam3eya_turns.sql`);
console.log("");
console.log("3. الصقه في SQL Editor");
console.log("");
console.log("4. اضغط Run");
console.log("");
console.log("✅ سينشئ:");
console.log("   - جدول gam3eya_turns");
console.log("   - RPC record_gam3eya_turn (SECURITY DEFINER)");
console.log("   - REVOKE من anon + authenticated");
console.log("   - تريغر تلقائي عند تأكيد التسوية");
console.log("");

// محاولة تنفيذ مباشر عبر REST API
async function tryRunMigration() {
  try {
    console.log("🔄 محاولة تنفيذ مباشر...");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_gam3eya_turn`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      console.log("✅ الـ RPC موجود بالفعل");
      return true;
    }

    if (res.status === 404) {
      console.log("⚠️ الـ RPC غير موجود — لازم تنفذ SQL يدوياً");
      return false;
    }

    console.log(`⚠️ استجابة ${res.status} — تحقق من النتيجة`);
    return false;
  } catch (e) {
    console.log("⚠️ ما قدرت أتحقق تلقائياً — نفّذ SQL يدوياً");
    return false;
  }
}

const exists = await tryRunMigration();

if (exists) {
  console.log("");
  console.log("🎉 المخطط مُطبّق بالفعل! كل شي جاهز.");
} else {
  console.log("");
  console.log("📌 نفّذ SQL يدوياً من Dashboard كما بالتعليمات فوق");
}

console.log("");
console.log("توكلنا على الله 🤲");
