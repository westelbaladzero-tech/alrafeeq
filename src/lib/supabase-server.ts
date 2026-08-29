// عميل Supabase للخادم
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// عميل admin (service role) — يتجاوز RLS
export function getAdminClient(): SupabaseClient | null {
  if (!SERVICE_KEY || !URL) return null;
  return createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// عميل خادم (anon key) — للعمليات اللي تحتاج جلسة المستخدم
// بدون persistSession لأن localStorage ما يوجد على الخادم
export function getServerClient(): SupabaseClient | null {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !anonKey) return null;
  return createClient(URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
