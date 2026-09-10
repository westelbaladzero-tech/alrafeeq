import { getSupabase } from "./supabase";

/**
 * يرجع headers المصادقة من JWT مُتحقّق منه.
 * يستخدم في كل fetch call بدل x-client-id المكشوف.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const sb = getSupabase() as any;
  if (!sb) return {};
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}
  return {};
}
