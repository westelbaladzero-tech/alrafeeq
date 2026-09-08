// ─── سجل تدقيق غير قابل للتعديل (append-only) ───
import { getAdminClient } from "./supabase-server";

export async function logFinancialEvent(params: {
  eventType: string;
  actorId: string;
  targetUserId?: string;
  entityType: string;
  entityId: string;
  amount?: number;
  metadata?: Record<string, any>;
  req?: Request;
}): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    await admin.from("audit_log").insert({
      event_type: params.eventType,
      actor_id: params.actorId,
      target_user_id: params.targetUserId || null,
      entity_type: params.entityType,
      entity_id: params.entityId,
      amount: params.amount || null,
      metadata: params.metadata || null,
      ip_address: params.req?.headers?.get?.("x-forwarded-for") || null,
    });
  } catch (e) {
    // السجل لا يوقف العملية — لكن سجّل الخطأ
    console.error("audit_log error:", e);
  }
}
