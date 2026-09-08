// ─── فحص فعلي للملفات المرفوعة (magic bytes + حجم + نوع) ───

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function validateReceiptFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // ─── تحقق من الحجم ───
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "الملف أكبر من 5 ميجابايت" };
  }

  // ─── تحقق من النوع المُعلن ───
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "نوع ملف غير مسموح (JPG/PNG/WebP/PDF فقط)" };
  }

  // ─── تحقق من magic bytes الفعلية ───
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

  if (!isJPEG && !isPNG && !isPDF && !isWebP) {
    return { valid: false, error: "محتوى الملف لا يطابق نوعه المُعلن" };
  }

  return { valid: true };
}
