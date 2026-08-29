// عميل Supabase للمتصفح
import { createBrowserClient } from '@supabase/ssr';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseEnabled = !!URL && !!ANON;

export function getSupabase() {
  if (!isSupabaseEnabled) return null;
  return createBrowserClient(URL, ANON);
}
