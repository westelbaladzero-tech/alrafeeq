import { NextResponse } from "next/server";
import { trackUsage } from "@/lib/usage";
import { rateLimitDB, getClientId } from "@/lib/rate-limit";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function extractText(payload: any): string {
  if (payload?.output_text) return payload.output_text;
  const steps = payload?.steps;
  if (!Array.isArray(steps)) return "";
  const texts: string[] = [];
  for (const step of steps) {
    const content = step?.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item?.text) texts.push(item.text);
    }
  }
  return texts.join("").trim();
}

export async function POST(req: Request) {
  // ─── Rate limiting: 15 صورة/دقيقة ───
  const rl = await rateLimitDB("img:" + getClientId(req), 15, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
  }
  try {
    const formData = await req.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "لم يصل ملف صورة" }, { status: 400 });
    }

    const mimeType = image.type || "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "الملف ليس صورة" }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        ok: false,
        error: "مفتاح Gemini غير مضبوط على الخادم",
      }, { status: 500 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64Image = buffer.toString("base64");

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [
          {
            type: "text",
            text: "اقرأ كل النص الموجود في هذه الصورة واستخرجه كما هو، مع الحفاظ على لغته الأصلية وتنسيقه. إذا كانت الصورة تحتوي على نص عربي اكتبه بالعربية، وإذا كانت إنجليزية اكتبه بالإنجليزية، وهكذا. اكتب النص فقط بدون تعليق أو تفسير.",
          },
          {
            type: "image",
            data: base64Image,
            mime_type: mimeType,
          },
        ],
      }),
    });

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      const apiError = geminiData?.error?.message || "فشل تحليل الصورة";
      return NextResponse.json({ ok: false, error: apiError }, { status: 500 });
    }

    const rawText = extractText(geminiData).trim();
    if (!rawText) {
      return NextResponse.json({
        ok: false,
        error: "لم يتم العثور على نص في الصورة",
      }, { status: 500 });
    }

    await trackUsage("gemini", "image-text", true);

    return NextResponse.json({
      ok: true,
      text: rawText,
      message: "تم استخلاص النص بنجاح",
    });
  } catch {
    return NextResponse.json({ error: "تعذر تنفيذ تحليل الصورة الآن" }, { status: 500 });
  }
}
