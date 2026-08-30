import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { parseTransaction } from "@/lib/parser";

const GROQ_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `أنت "الرفيق" — صديق حقيقي لي {userName}. تتكلم بالعربية العامية المصرية بطبيعية ودفء.

شخصيتك:
- عامية مصرية مو فصحى جامدة. قول "تمام" و"يا باشا" و"حبيبي" بخفة
- ردودك متنوعة — ما تكرر نفس الصيغة
- إيموجي خفيف (👌😊😅💚🙏)
- قصير بس مفيد
- ذكي، تشوف الأنماط وتعلّق بدون إلحاح

طريقتك في الرد:
- مصروف: ذكر المبلغ والفئة وعلّق على الرصيد
- دخل: بارك وذكر الرصيد الجديد
- سؤال عن الرصيد: جاوب مباشر وعلّق
- رصيد سالب (مصروفات أكتر من دخل): قول "عليك X جنيه" مو "باقي عندك"
- سؤال عن المصروفات: لخّص بوضوح وكامل — ما تقص الإجابة
- تقرير: اذكر الدخل والمصروفات والرصيد وأعلى الفئات — كله في رسالة كاملة
- ما فهمت: اسأل ببساطة

{onboarding}

قواعد مهمة جداً:
- ما تقول "تم تسجيل" أو "تم اعتماد" — لغة روبوت
- قول "سجّلتها" أو "تمام" بطبيعية
- ناده باسمه أحياناً
- في حساب الرصيد: الدخل ناقص المصروفات. لو سالب قول "عليك"
- أكمل إجاباتك دائماً — ما تقصها في النص

قواعد إخراج JSON:
- أرجع JSON صالح فقط — بدون أي نص قبله أو بعده
- بدون علامات تنسيق json أو اقواس مزدوجة
- الـ reply فيها النص الطبيعي بس — بدون JSON أو كود
- لو الجواب طويل، خليه كامل في reply

بيانات {userName} المالية:
{context}

الفئات: مطاعم، مواصلات، فواتير، تسوق، صحة، تعليم، ترفيه، إيجار، راتب، أرباح، عمولة، أخرى

أرجع JSON بهذا الشكل بالظبط:
{"transaction": {"type": "expense|income", "amount": 0, "category": "", "main": "personal|work", "method": "cash|card|wallet|bank|unknown", "note": ""} أو null، "profile_update": {"name": ""} أو {"work_type": ""} أو null، "reply": "ردك هنا"}`;

// استخراج JSON من رد النموذج بطريقة قوية
function extractJson(content: string): any {
  let cleaned = content.trim();
  // إزالة علامات markdown
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // محاولة مباشرة
  try { return JSON.parse(cleaned); } catch {}
  // استخراج أول كائن JSON
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  // لو فشل كل شي، خلي الرد كله نص طبيعي
  return { reply: cleaned.replace(/[{}"\[\]]/g, "").replace(/transaction|profile_update|reply|type|amount|category|main|method|note|name|work_type|null/g, "").trim() || "تمام", transaction: null, profile_update: null };
}

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

  // اجلب الملف الشخصي
  let userName = userEmail ? userEmail.split("@")[0].split(".")[0] : "صاحبي";
  let userWorkType = "";
  let needsOnboarding = false;
  let onboardingStep = "";

  if (userId) {
    const admin = getAdminClient();
    if (admin) {
      const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (profile) {
        if (profile.name) userName = profile.name;
        if (profile.work_type) userWorkType = profile.work_type;
        if (!profile.name) { needsOnboarding = true; onboardingStep = "name"; }
        else if (!profile.work_type) { needsOnboarding = true; onboardingStep = "work_type"; }
      }
    }
  }

  let onboarding = "";
  if (needsOnboarding) {
    if (onboardingStep === "name") {
      onboarding = "تعليمات الاستقبال: المستخدم لسه ما قال اسمه. رحّب واسأله عن اسمه. لما يرد استخرج الاسم في profile_update.name";
    } else if (onboardingStep === "work_type") {
      onboarding = `تعليمات الاستقبال: المستخدم اسمه ${userName}. اسأله "وبتشتغل إيه يا ${userName}؟". لما يرد استخرج نوع الشغل في profile_update.work_type واقترح فئات تناسبه`;
    }
  } else {
    onboarding = `نوع شغل المستخدم: ${userWorkType || "غير محدد"}`;
  }

  // اجلب الإحصائيات
  let context = "لا توجد بيانات بعد — مستخدم جديد";
  if (userId) {
    try {
      const admin = getAdminClient();
      if (admin) {
        const { data: txs } = await admin
          .from("transactions").select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(20);

        if (txs && txs.length > 0) {
          const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const balance = income - expense;
          const byCat: Record<string, number> = {};
          for (const t of txs.filter((x: any) => x.type === "expense")) {
            byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
          }
          const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, a]) => c + ": " + a).join("، ");
          const recent = txs.slice(0, 5).map((t: any) => (t.type === "income" ? "+ دخل" : "- مصروف") + " " + t.amount + " " + t.category).join("\n");

          context = "الرصيد: " + balance + " جنيه (الرصيد = الدخل ناقص المصروفات، لو سالب يعني صرف أكتر من دخله)\n" +
            "إجمالي الدخل: " + income + "\nإجمالي المصروفات: " + expense + "\n" +
            "أعلى الفئات: " + (topCats || "لا يوجد") + "\nآخر المعاملات:\n" + recent;
        }
      }
    } catch {}
  }

  // fallback محلي
  if (!GROQ_KEY) {
    const p = parseTransaction(message);
    if (p && userId) {
      const admin = getAdminClient();
      if (admin) await admin.from("transactions").insert({ user_id: userId, type: p.type, amount: p.amount, category: p.category, main: p.main, method: p.method, note: p.note });
    }
    return NextResponse.json({ reply: p ? "سجّلتها يا " + userName + " 👌" : "جرّب: صرفت ٥٠ على غداء", transaction: p });
  }

  const prompt = SYSTEM_PROMPT
    .replace(/\{userName\}/g, userName)
    .replace("{context}", context)
    .replace("{onboarding}", onboarding);

  const messages: any[] = [{ role: "system", content: prompt }];
  if (history && Array.isArray(history)) {
    for (const h of history.slice(-4)) {
      messages.push({ role: h.role === "bot" ? "assistant" : "user", content: h.text });
    }
  }
  messages.push({ role: "user", content: message });

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages, temperature: 0.8, max_tokens: 600 }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = extractJson(content);

    // احفظ المعاملة
    if (parsed.transaction && userId) {
      const t = parsed.transaction;
      const admin = getAdminClient();
      if (admin) await admin.from("transactions").insert({
        user_id: userId, type: t.type, amount: Number(t.amount), category: t.category || "أخرى",
        main: t.main || "personal", method: t.method || "unknown", note: t.note || message,
      });
    }

    // حدّث الملف الشخصي
    if (parsed.profile_update && userId) {
      const admin = getAdminClient();
      if (admin) {
        const update: any = {};
        if (parsed.profile_update.name) update.name = parsed.profile_update.name;
        if (parsed.profile_update.work_type) update.work_type = parsed.profile_update.work_type;
        if (Object.keys(update).length > 0) await admin.from("profiles").update(update).eq("id", userId);
      }
    }

    return NextResponse.json({ reply: parsed.reply || "تمام", transaction: parsed.transaction || null });
  } catch {
    const p = parseTransaction(message);
    return NextResponse.json({ reply: p ? "سجّلتها يا " + userName + " ✅" : "جرّب مرة ثانية 🙏", transaction: p });
  }
}
