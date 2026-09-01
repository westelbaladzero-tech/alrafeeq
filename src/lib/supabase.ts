// عميل Supabase للمتصفح — نستخدم PKCE لأن callback page تبدّل code إلى session
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseEnabled = !!URL && !!ANON;

let client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!isSupabaseEnabled) return null;
  if (!client) {
    client = createClient(URL, ANON, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }
  return client;
}
