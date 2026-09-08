// ============================================================
// سكربت تشغيل مخطط P2P على Supabase
// التشغيل: node scripts/run-p2p-migration.mjs
// يحتاج: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = join(__dirname, "..", "supabase", "p2p_system.sql");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ ناقص: NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY");
  console.error("   اضبطها في .env.local أو في البيئة ثم أعد التشغيل");
  process.exit(1);
}

const sql = readFileSync(SQL_FILE, "utf-8");

// استخدم Supabase REST API لتنفيذ SQL عبر دالة rpc
// ملاحظة: Supabase لا يدعم تنفيذ SQL عشوائي عبر REST مباشرة
// لذا نستخدم Postgres connection string عبر fetch إلى /pg endpoint

// الطريقة: استخدم Supabase Management API (يتطلب project ref)
// استخراج project ref من URL
const ref = SUPABASE_URL.replace("https://", "").split(".")[0];

console.log("🔗 Project ref:", ref);
console.log("📄 SQL file:", SQL_FILE);
console.log("📏 SQL size:", sql.length, "chars");
console.log("");

// تقسيم SQL إلى عبارات منفصلة
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`📊 عدد العبارات: ${statements.length}`);
console.log("");

// تنفيذ كل عبارة عبر PostgREST (لا يدعم DDL)
// لذا نطبع التعليمات فقط
console.log("=" .repeat(60));
console.log("📋 تعليمات التنفيذ:");
console.log("=" .repeat(60));
console.log("");
console.log("1. افتح Supabase Dashboard:");
console.log(`   https://supabase.com/dashboard/project/${ref}/sql/new`);
console.log("");
console.log("2. انسخ محتوى الملف:");
console.log(`   supabase/p2p_system.sql`);
console.log("");
console.log("3. الصقه في SQL Editor");
console.log("");
console.log("4. اضغط Run");
console.log("");
console.log("✅ ستنشئ الجداول والدوال والـ RLS");
console.log("");

// اطبع أول 3 عبارات للمعاينة
console.log("معاينة أول 3 عبارات:");
console.log("-".repeat(60));
statements.slice(0, 3).forEach((s, i) => {
  console.log(`\n[${i + 1}] ${s.substring(0, 100)}${s.length > 100 ? "..." : ""}`);
});
console.log("");
console.log("توكلنا على الله 🤲");
