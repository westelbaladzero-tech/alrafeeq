import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "لم يصل ملف صوتي للاختبار" }, { status: 400 });
    }

    const bytes = audio.size;
    const mimeType = audio.type || "audio/webm";

    return NextResponse.json({
      ok: true,
      bytes,
      mimeType,
      message: "وصل التسجيل بنجاح إلى المسار المنفصل. الخطوة التالية تكون ربطه بطبقة Gemini عند الجاهزية.",
    });
  } catch {
    return NextResponse.json({ error: "تعذر تنفيذ اختبار الميكروفون الآن" }, { status: 500 });
  }
}
