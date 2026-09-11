import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";

// ─── رفع آمن للملفات (server-side + magic bytes) ───
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (تحت حد Vercel 4.5MB)
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

function detectType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  return null;
}

export async function POST(req: NextRequest) {
  // ─── Rate limiting ───
  const clientId = getClientId(req as unknown as Request);
  const rl = await rateLimitDB("upload:ip:" + clientId, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const folderRaw = (formData.get("folder") as string) || "chat";
  const folder = /^[a-zA-Z0-9_-]+$/.test(folderRaw) ? folderRaw : "chat";
  const expiryRaw = parseInt(formData.get("expiry") as string) || 3600;
  const expiry = Math.max(60, Math.min(86400, expiryRaw));

  if (!file) {
    return NextResponse.json({ error: "ملف مفقود" }, { status: 400 });
  }

  // ─── تحقق من الحجم ───
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "الملف أكبر من 4 ميجابايت" }, { status: 400 });
  }

  // ─── magic bytes check ───
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const detected = detectType(bytes);

  if (!detected) {
    return NextResponse.json({ error: "محتوى الملف غير صالح" }, { status: 400 });
  }
  if (!(detected in ALLOWED)) {
    return NextResponse.json({ error: "نوع ملف غير مسموح" }, { status: 400 });
  }

  // ─── رفع عبر service_role ───
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });
  }

  const ext = ALLOWED[detected];
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from("chat-files")
    .upload(fileName, file, { contentType: detected });

  if (upErr) {
    return NextResponse.json({ error: "فشل الرفع" }, { status: 500 });
  }

  const { data: urlData } = await admin.storage
    .from("chat-files")
    .createSignedUrl(fileName, expiry);

  return NextResponse.json({
    ok: true,
    url: urlData?.signedUrl,
    path: fileName,
    type: detected,
  });
}
