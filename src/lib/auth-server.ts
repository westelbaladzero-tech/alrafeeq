import { NextRequest } from "next/server";
import { getServerClient } from "./supabase-server";

/**
 * يستخرج userId من JWT مُتحقّق منه — مو من header بلا تحقق.
 * يقرأ الـ access token من Authorization header أو x-access-token.
 * يتحقق منه عبر sb.auth.getUser(token) → userId موثوق.
 */
export async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    token = req.headers.get("x-access-token");
  }

  if (!token) return null;

  const sb = getServerClient();
  if (!sb) return null;

  try {
    const { data: { user } } = await sb.auth.getUser(token);
    return user?.id || null;
  } catch {
    return null;
  }
}
