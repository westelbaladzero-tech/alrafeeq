import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function extractOutputText(payload: any): string {
  return payload?.output_text
    || payload?.outputText
    || payload?.interaction?.output_text
    || payload?.interaction?.outputText
    || payload?.interaction?.response?.output_text
    || "";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "لم يصل ملف صوتي للاختبار" }, { status: 400 });
    }

    const bytes = audio.size;
    const mimeType = audio.type || "audio/webm";

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        ok: false,
        bytes,
        mimeType,
        error: "اختبار التسجيل نجح، لكن مفتاح Gemini غير مضبوط بعد على الخادم.",
      }, { status: 500 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const base64Audio = buffer.toString("base64");

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.7-flash",
        input: [
          {
            type: "text",
            text: "فرّغ الكلام المسموع في هذا التسجيل إلى نص عربي واضح فقط، بدون شرح إضافي، وبدون ترجمة، وبدون مقدمة.",
          },
          {
            type: "audio",
            data: base64Audio,
            mime_type: mimeType,
          },
        ],
      }),
    });

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      const apiError = geminiData?.error?.message || "فشل استدعاء Gemini لتفريغ الصوت";
      return NextResponse.json({ ok: false, bytes, mimeType, error: apiError }, { status: 500 });
    }

    const transcript = extractOutputText(geminiData).trim();
    if (!transcript) {
      return NextResponse.json({
        ok: false,
        bytes,
        mimeType,
        error: "وصل التسجيل إلى Gemini لكن لم يرجع نصًا واضحًا بعد.",
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      bytes,
      mimeType,
      transcript,
      message: "تم تفريغ التسجيل إلى نص داخل المسار المنفصل بنجاح.",
    });
  } catch {
    return NextResponse.json({ error: "تعذر تنفيذ اختبار الميكروفون الآن" }, { status: 500 });
  }
}
