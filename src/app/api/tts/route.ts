import { NextRequest, NextResponse } from "next/server";
import { getUserIdSync } from "@/lib/client-id";
import { trackUsage } from "@/lib/usage";

// مفاتيح Google Cloud TTS (نفس مفتاح Gemini أو مفتاح منفصل)
const GOOGLE_TTS_KEY =
  process.env.GOOGLE_TTS_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY ||
  "";

// أصوات عربية متاحة
const AR_VOICES = {
  "ar-XA": {
    female: "ar-XA-Wavenet-A",
    male: "ar-XA-Wavenet-B",
    female2: "ar-XA-Neural2-C",
    male2: "ar-XA-Neural2-D",
  },
};

// أصوات إنجليزية
const EN_VOICES = {
  "en-US": {
    female: "en-US-Wavenet-F",
    male: "en-US-Wavenet-D",
  },
};

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdSync();
    if (!userId) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    }

    const { text, lang = "ar-XA", voice = "female", rate = 1.0 } =
      await req.json();

    if (!text || text.length > 5000) {
      return NextResponse.json(
        { error: "النص مفقود أو طويل جداً (حد 5000 حرف)" },
        { status: 400 }
      );
    }

    // لو لا يوجد مفتاح Google ← أخبر العميل للاستخدام المتصفح
    if (!GOOGLE_TTS_KEY) {
      return NextResponse.json({
        ok: false,
        fallback: "browser",
        message: "لا يوجد مفتاح Google TTS — استخدم المتصفح",
      });
    }

    // اختر الصوت المناسب
    const voiceName = pickVoice(lang, voice);
    if (!voiceName) {
      return NextResponse.json({
        ok: false,
        fallback: "browser",
        message: "لا يوجد صوت متاح لهذه اللغة",
      });
    }

    // استدعِ Google Cloud TTS
    const ttsRes = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: lang,
            name: voiceName,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: rate,
            pitch: 0,
            volumeGainDb: 0,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.warn("Google TTS error:", errText);
      await trackUsage("gemini", "tts", false);
      return NextResponse.json({
        ok: false,
        fallback: "browser",
        message: "فشل Google TTS — استخدم المتصفح",
      });
    }

    const data = await ttsRes.json();
    await trackUsage("gemini", "tts", true);

    return NextResponse.json({
      ok: true,
      audio: data.audioContent, // base64 MP3
      voice: voiceName,
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { ok: false, fallback: "browser", message: "خطأ في الخادم" },
      { status: 500 }
    );
  }
}

function pickVoice(lang: string, gender: string): string | null {
  // عربي
  if (lang.startsWith("ar")) {
    const ar = AR_VOICES["ar-XA"];
    if (gender === "male") return ar.male || ar.male2;
    return ar.female || ar.female2;
  }
  // إنجليزي
  if (lang.startsWith("en")) {
    const en = EN_VOICES["en-US"];
    return gender === "male" ? en.male : en.female;
  }
  return null;
}

// GET لإختبار التوفّر
export async function GET() {
  return NextResponse.json({
    ok: !!GOOGLE_TTS_KEY,
    hasKey: !!GOOGLE_TTS_KEY,
    voices: { ar: AR_VOICES["ar-XA"], en: EN_VOICES["en-US"] },
  });
}
