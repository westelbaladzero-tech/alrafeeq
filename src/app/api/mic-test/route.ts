import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function extractTranscript(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p: any) => p?.text || "").join("").trim();
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
        contents: [
          {
            parts: [
              {
                text: "فرّغ الكلام المسموع في هذا التسجيل إلى نص عربي واضح فقط، بدون شرح إضافي، وبدون ترجمة، وبدون مقدمة.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      const apiError = geminiData?.error?.message || "فشل استدعاء Gemini لتفريغ الصوت";
      return NextResponse.json({ ok: false, bytes, mimeType, error: apiError }, { status: 500 });
    }

    const transcript = extractTranscript(geminiData).trim();
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
