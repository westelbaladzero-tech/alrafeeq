import { NextResponse, NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { getClientId } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check what IP Vercel reports
  const clientId = getClientId(req as unknown as Request);
  const vercelFwd = req.headers.get("x-vercel-forwarded-for");
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({
      step: "getAdminClient",
      url: url ? url.substring(0, 30) + "..." : "(empty)",
      hasServiceKey: hasKey,
      error: "getAdminClient returned null",
    });
  }

  // Use the ACTUAL client ID as the key (same as verify-pin)
  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    p_key: "pin:" + clientId,
    p_limit: 5,
    p_window_seconds: 60,
  });

  return NextResponse.json({
    step: "rpc",
    adminOk: true,
    clientId,
    headers: { vercelFwd, forwarded, realIp },
    rateLimitKey: "pin:" + clientId,
    rpcResult: data,
    rpcError: error ? error.message : null,
  });
}
