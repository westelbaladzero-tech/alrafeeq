import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({
      step: "getAdminClient",
      url: url ? url.substring(0, 30) + "..." : "(empty)",
      hasServiceKey: hasKey,
      error: "getAdminClient returned null",
    });
  }

  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    p_key: "debug:test",
    p_limit: 5,
    p_window_seconds: 60,
  });

  return NextResponse.json({
    step: "rpc",
    adminOk: true,
    url: url.substring(0, 30) + "...",
    hasServiceKey: hasKey,
    rpcResult: data,
    rpcError: error ? error.message : null,
  });
}
