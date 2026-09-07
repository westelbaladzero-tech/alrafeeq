// ─── تطهير رسائل الشات (client-side) ───

export function sanitizeMessage(input: string, maxLength: number = 2000): string {
  if (!input) return "";
  return input
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .trim();
}
