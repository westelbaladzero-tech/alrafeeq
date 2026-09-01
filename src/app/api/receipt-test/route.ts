import { NextResponse } from "next/server";
import { trackUsage } from "@/lib/usage";

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

interface ReceiptData {
  merchant?: string;
  total?: string;
  date?: string;
  category?: string;
  items?: string[];
  raw?: string;
}

function parseReceipt(text: string): ReceiptData {
  const result: ReceiptData = { raw: text };

  const merchantMatch = text.match(/(?:المتجر|الاسم|اسم المحل|Merchant|Store)[:\s]+(.+)/i);
  if (merchantMatch) result.merchant = merchantMatch[1].trim();

  const totalMatch = text.match(/(?:الإجمالي|المبلغ|الاجمالي|Total|Amount)[:\s]+([\d.,]+)/i);
  if (totalMatch) result.total = totalMatch[1].trim();

  const dateMatch = text.match(/(?:التاريخ|Date)[:\s]+(.+)/i);
  if (dateMatch) result.date = dateMatch[1].trim();

  const catMatch = text.match(/(?:التصنيف|الفئة|Category)[:\s]+(.+)/i);
  if (catMatch) result.category = catMatch[1].trim();

  const itemsMatch = text.match(/(?:العناصر|البنود|Items)[:\s]*\n?((?:[-•\d].+\n?)+)/i);
  if (itemsMatch) {
    result.items = itemsMatch[1].split("\n").map(s => s.replace(/^[-•\d.\s]+/, "").trim()).filter(Boolean);
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "لم يصل ملف صورة للاختبار" }, { status: 400 });
    }

    const bytes = image.size;
    const mimeType = image.type || "image/jpeg";

    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "الملف ليس صورة" }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        ok: false,
        bytes,
        mimeType,
        error: "اختبار الصورة نجح، لكن مفتاح Gemini غير مضبوط بعد على الخادم.",
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
            text: "أنت أداة لقراءة الفواتير والإيصالات. حلّل الصورة المرفقة واستخرج البيانات التالية بصيغة نص واضح:\n\nالمتجر: (اسم المحل أو المطعم)\nالإجمالي: (المبلغ الإجمالي بالأرقام)\nالتاريخ: (تاريخ الفاتورة)\nالتصنيف: (أكل/تسوق/وقود/كهرباء/مياه/اتصالات/أخرى)\nالعناصر:\n- (قائمة بالعناصر والأسعار)\n\nإذا لم تجد قيمة واضحة، اكتب (غير محدد). اكتب الأرقام بالأرقام وليس بالحروف.",
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
      const apiError = geminiData?.error?.message || "فشل استدعاء Gemini لتحليل الصورة";
      return NextResponse.json({ ok: false, bytes, mimeType, error: apiError }, { status: 500 });
    }

    const rawText = extractText(geminiData).trim();
    if (!rawText) {
      return NextResponse.json({
        ok: false,
        bytes,
        mimeType,
        error: "وصلت الصورة إلى Gemini لكن لم يرجع نصًا واضحًا بعد.",
      }, { status: 500 });
    }

    const parsed = parseReceipt(rawText);

    await trackUsage("gemini", "receipt-test", true);

    return NextResponse.json({
      ok: true,
      bytes,
      mimeType,
      rawText,
      merchant: parsed.merchant || "غير محدد",
      total: parsed.total || "غير محدد",
      date: parsed.date || "غير محدد",
      category: parsed.category || "غير محدد",
      items: parsed.items || [],
      message: "تم تحليل الصورة واستخراج البيانات بنجاح.",
    });
  } catch {
    return NextResponse.json({ error: "تعذر تنفيذ تحليل الصورة الآن" }, { status: 500 });
  }
}
