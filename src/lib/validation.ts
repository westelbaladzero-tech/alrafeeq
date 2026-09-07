// ─── تحقق وتطهير المدخلات ───

// طهّر النص من أكواد خطرة (XSS)
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input) return "";
  return input
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

// تحقق من رقم الهاتف
export function validatePhone(phone: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(phone);
}

// تحقق من المبلغ المالي
export function validateAmount(amount: any): { ok: boolean; value: number } {
  const n = Number(amount);
  if (isNaN(n) || n <= 0 || n > 1000000) return { ok: false, value: 0 };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

// تحقق من PIN
export function validatePin(pin: string): boolean {
  return /^[0-9]{4,8}$/.test(pin);
}

// تحقق من نوع الملف المسموح
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav",
  "video/mp4", "video/webm",
  "application/pdf",
  "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
];

export function validateFileType(mimeType: string): boolean {
  return ALLOWED_TYPES.includes(mimeType);
}

// تحقق من حجم الملف
export function validateFileSize(size: number, maxMB: number = 50): boolean {
  return size > 0 && size <= maxMB * 1024 * 1024;
}
