import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { parseTransaction } from "@/lib/parser";

const GROQ_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `أنت "الرفيق" — ما أنت تطبيق، أنت صديق حقيقي لي {userName}. تتكلم معه بالعربية العامية المصرية بطبيعية ودفء.

شخصيتك:
- تتكلم بالعامية المصرية، مو فصحى جامدة. قول "تمام" و"حبيبي" و"يا باشا" بخفة
- ردودك متنوعة — ما تكرر نفس الصيغة كل مرة
- إيموجي خفيف ومحبب (👌😊😅💚🙏)
- قصير بس مفيد — سطرين بالكثير
- ذكي، تشوف الأنماط وتعلّق عليها بدون إلحاح

طريقتك في الرد:
- مصروف مسجّل: ذكر المبلغ والفئة، وعلّق على الرصيد
  مثل: "سجّلتها 👌 باقي عندك ٤٥٠" أو "تمام يا {userName}، ٥٠ على الغداء. رصيدك الحين ٤٥٠"
- دخل وصل: بارك له وذكر الرصيد الجديد
  مثل: "وصلت 💚 رصيدك صار ٣٤٥٠" أو "مبروك يا باشا! صار عندك ٣٤٥٠"
- سؤال عن الرصيد: جاوب مباشر وعلّق بخفة
  مثل: "عندك ٤٥٠ جنيه. لو صرفت ١٥ يومياً يكفيك لحد آخر الشهر"
- سؤال عن المصروفات: لخّص بوضوح
  مثل: "صرفت ١٢٠٠ هالشهر — أكثر شي المطاعم ٦٠٠ جنيه 😅"
- لاحظت نمط: علّق بخفة
  مثل: "القهوة بتاخد نص مصروفك تقريباً 😅" أو "صرفك هالشهر أقل من اللي فاته 👍"
- ما فهمت: اسأل ببساطة
  مثل: "على إيش؟ 😄" أو "كم المبلغ بالظبط؟"

مهم جداً:
- ما تقول "تم تسجيل" أو "تم اعتماد العملية" — هذي لغة روبوتية
- قول "سجّلتها" أو "تمام" أو "خلاص يا باشا" بطبيعية
- ناده باسمه {userName} أحياناً بس مو كل مرة
- لو سأل سؤال ما تقدر تجاوبه من البيانات، قول بحب

بيانات {userName} المالية:
{context}

الفئات: مطاعم، مواصلات، فواتير، تسوق، صحة، تعليم، ترفيه، إيجار، راتب، أرباح، عمولة، أخرى

أرجع JSON فقط:
{"transaction": {"type": "expense|income", "amount": رقم, "category": "فئة", "main": "personal|work", "method": "cash|card|wallet|bank|unknown", "note": "ملاحظة قصيرة"} أو null، "reply": "ردك الطبيعي بالعامية"}`;

export async function POST(req: NextRequest) {
  const { message, accessToken, history } = await req.json();
  if (!message) return NextResponse.json({ error: "رسالة فارغة" }, { status: 400 });

  const sb = getServerClient();
  if (!sb) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  let userId: string | null = null;
  let userEmail: string | null = null;
  if (accessToken) {
    const { data: { user } } = await sb.auth.getUser(accessToken);
    userId = user?.id || null;
    userEmail = user?.email || null;
  }

  // اسم المستخدم من الإيميل
  const userName = userEmail ? userEmail.split("@")[0].split(".")[0] : "صاحبي";
  const niceName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // اجلب إحصائيات المستخدم
  let context = "لا توجد بيانات بعد — هذا مستخدم جديد";
  if (userId) {
    try {
      const admin = getAdminClient();
      if (admin) {
        const { data: txs } = await admin
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (txs && txs.length > 0) {
          const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const balance = income - expense;

          // أعلى الفئات
          const byCat: Record<string, number> = {};
          for (const t of txs.filter((x: any) => x.type === "expense")) {
            byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
          }
          const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, a]) => c + ": " + a).join("، ");

          const recent = txs.slice(0, 5).map((t: any) =>
            (t.type === "income" ? "+ دخل" : "- مصروف") + " " + t.amount + " " + t.category
          ).join("\n");

          context = "الرصيد: " + balance + " جنيه\nإجمالي الدخل: " + income + "\nإجمالي المصروفات: " + expense + "\nأعلى الفئات: " + (topCats || "لا يوجد") + "\nآخر المعاملات:\n" + recent;
        }
      }
    } catch {}
  }

  // لو ما في مفتاح Groq — استخدم المحلل المحلي
  if (!GROQ_KEY) {
    const p = parseTransaction(message);
    if (p && userId) {
      const admin = getAdminClient();
      if (admin) {
        await admin.from("transactions").insert({
          user_id: userId,
          type: p.type, amount: p.amount, category: p.category,
          main: p.main, method: p.method, note: p.note,
        });
      }
    }
    const reply = p
      ? "سجّلتها يا " + niceName + " 👌 " + p.amount + " على " + p.category
      : "ما فهمت المبلغ يا " + niceName + ". جرّب: صرفت ٥٠ على غداء";
    return NextResponse.json({ reply, transaction: p });
  }

  // بناء رسائل المحادثة مع التاريخ
  const prompt = SYSTEM_PROMPT
    .replace(/\{userName\}/g, niceName)
    .replace("{context}", context);

  const messages: any[] = [{ role: "system", content: prompt }];

  // أضف آخر ٤ رسائل من التاريخ للسياق
  if (history && Array.isArray(history)) {
    for (const h of history.slice(-4)) {
      messages.push({ role: h.role === "bot" ? "assistant" : "user", content: h.text });
    }
  }

  messages.push({ role: "user", content: message });

  // استدعاء Groq
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); }
    catch { parsed = { reply: content, transaction: null }; }

    // احفظ المعاملة لو موجودة
    if (parsed.transaction && userId) {
      const t = parsed.transaction;
      const admin = getAdminClient();
      if (admin) {
        await admin.from("transactions").insert({
          user_id: userId,
          type: t.type, amount: Number(t.amount), category: t.category || "أخرى",
          main: t.main || "personal", method: t.method || "unknown",
          note: t.note || message,
        });
      }
    }

    return NextResponse.json({ reply: parsed.reply || "تمام", transaction: parsed.transaction || null });
  } catch {
    const p = parseTransaction(message);
    const reply = p
      ? "سجّلتها يا " + niceName + " ✅ " + p.amount + " على " + p.category
      : "صار خطأ بسيط يا " + niceName + "، جرّب مرة ثانية 🙏";
    return NextResponse.json({ reply, transaction: p });
  }
}
