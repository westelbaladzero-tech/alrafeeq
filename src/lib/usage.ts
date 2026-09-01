import { getAdminClient } from "./supabase-server";

export type ServiceName = "gemini" | "groq" | "magic_link";
export type EndpointName = "mic-test" | "receipt-test" | "chat" | "login" | "register" | "recover";

export async function trackUsage(
  service: ServiceName,
  endpoint: EndpointName,
  success: boolean = true,
  userId?: string
): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    await admin.from("service_usage").insert({
      service,
      endpoint,
      success,
      user_id: userId || null,
    });
  } catch {}
}

export async function getTodayUsage() {
  const admin = getAdminClient();
  if (!admin) return { gemini: 0, groq: 0, magic_link: 0, byEndpoint: [] as { endpoint: string; count: number }[] };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startISO = today.toISOString();

    const { data } = await admin
      .from("service_usage")
      .select("service, endpoint, success")
      .gte("created_at", startISO);

    if (!data || data.length === 0) return { gemini: 0, groq: 0, magic_link: 0, byEndpoint: [] };

    const counts = { gemini: 0, groq: 0, magic_link: 0 };
    const endpointMap: Record<string, number> = {};

    for (const row of data) {
      const svc = row.service as ServiceName;
      if (counts[svc] !== undefined) counts[svc]++;
      const key = `${row.endpoint}`;
      endpointMap[key] = (endpointMap[key] || 0) + 1;
    }

    const byEndpoint = Object.entries(endpointMap).map(([endpoint, count]) => ({ endpoint, count }));
    return { ...counts, byEndpoint };
  } catch {
    return { gemini: 0, groq: 0, magic_link: 0, byEndpoint: [] };
  }
}

export async function getMonthUsage() {
  const admin = getAdminClient();
  if (!admin) return { gemini: 0, groq: 0, magic_link: 0 };

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startISO = startOfMonth.toISOString();

    const { data } = await admin
      .from("service_usage")
      .select("service")
      .gte("created_at", startISO);

    if (!data || data.length === 0) return { gemini: 0, groq: 0, magic_link: 0 };

    const counts = { gemini: 0, groq: 0, magic_link: 0 };
    for (const row of data) {
      const svc = row.service as ServiceName;
      if (counts[svc] !== undefined) counts[svc]++;
    }
    return counts;
  } catch {
    return { gemini: 0, groq: 0, magic_link: 0 };
  }
}
