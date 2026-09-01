import { NextResponse } from "next/server";
import { trackUsage } from "@/lib/usage";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function extractTranscript(payload: any): string {
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
        model: GEMINI_MODEL,
        input: [
          {
            type: "text",
            text: "أنت أداة تفريغ صوتي. استمع للتسجيل وفرّغه إلى نص عربي باللهجة المصرية العامية كما هو منطوق تمامًا، بدون أي شرح أو ترجمة أو مقدمة أو تعليق. اكتب فقط ما تقوله بالضبط. الأرقام والأعداد اكتبها بالأرقام وليس بالحروف، مثلاً: خمسين → 50، مية → 100، خمسة وتلاتين → 35.",
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

    const transcript = extractTranscript(geminiData).trim();
    if (!transcript) {
      return NextResponse.json({
        ok: false,
        bytes,
        mimeType,
        error: "وصل التسجيل إلى Gemini لكن لم يرجع نصًا واضحًا بعد.",
      }, { status: 500 });
    }

    await trackUsage("gemini", "mic-test", true);

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
