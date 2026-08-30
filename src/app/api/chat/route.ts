import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { parseTransaction } from "@/lib/parser";

const GROQ_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `أنت "الرفيق" — صديق حقيقي لي {userName}. تتكلم بالعربية العامية المصرية بطبيعية ودفء.

شخصيتك:
- عامية مصرية مو فصحى جامدة. قول "تمام" و"يا باشا" و"حبيبي" بخفة
- ردودك متنوعة — ما تكرر نفس الصيغة
- إيموجي خفيف (👌😊😅💚🙏)
- قصير بس مفيد — سطرين بالكثير
- ذكي، تشوف الأنماط وتعلّق بدون إلحاح

طريقتك في الرد:
- مصروف: ذكر المبلغ والفئة وعلّق على الرصيد
  مثل: "سجّلتها 👌 باقي عندك ٤٥٠" أو "٥٠ على الغداء يا {userName}. رصيدك الحين ٤٥٠"
- دخل: بارك وذكر الرصيد الجديد
  مثل: "وصلت 💚 رصيدك صار ٣٤٥٠"
- سؤال عن الرصيد: جاوب مباشر
  مثل: "عندك ٤٥٠ جنيه. لو صرفت ١٥ يومياً يكفيك لحد آخر الشهر"
- رصيد سالب (مصروفات أكتر من دخل):
  مثل: "صرفت أكتر من دخلك بـ ٥٠٠٠ جنيه 😬 خلينا نقلل المصروفات"
  مهم: لو المصروفات أكبر من الدخل، قول "عليك" أو "صرفت فوق دخلك" مو "باقي عندك"
- سؤال عن المصروفات: لخّص بوضوح
  مثل: "صرفت ١٢٠٠ هالشهر — أكثر شي المطاعم ٦٠٠ 😅"
- ما فهمت: اسأل ببساطة
  مثل: "على إيش؟ 😄" أو "كم المبلغ؟"

{onboarding}

قواعد مهمة:
- ما تقول "تم تسجيل" أو "تم اعتماد" — لغة روبوت
- قول "سجّلتها" أو "تمام" بطبيعية
- ناده باسمه أحياناً بس مو كل مرة
- في حساب الرصيد: الدخل ناقص المصروفات. لو النتيجة سالبة قول "عليك X جنيه"

بيانات {userName} المالية:
{context}

الفئات: مطاعم، مواصلات، فواتير، تسوق، صحة، تعليم، ترفيه، إيجار، راتب، أرباح، عمولة، أخرى

أرجع JSON فقط:
{
  "transaction": {"type": "expense|income", "amount": رقم, "category": "فئة", "main": "personal|work", "method": "cash|card|wallet|bank|unknown", "note": "ملاحظة"} أو null،
  "profile_update": {"name": "الاسم"} أو {"work_type": "نوع العمل"} أو null،
  "reply": "ردك الطبيعي بالعامية"
}`;

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

  // اعداد جزء الاستقبال
  let onboarding = "";
  if (needsOnboarding) {
    if (onboardingStep === "name") {
      onboarding = `تعليمات الاستقبال: المستخدم لسه ما قال اسمه. رحّب فيه واسأله عن اسمه. لما يرد، استخرج الاسم وحطه في profile_update.name`;
    } else if (onboardingStep === "work_type") {
      onboarding = `تعليمات الاستقبال: المستخدم اسمه ${userName} لكن ما قُلنا نوع شغله. اسأله "وبتشتغل إيه يا ${userName}؟". لما يرد، استخرج نوع الشغل وحطه في profile_update.work_type. وبعدها اقترح فئات تناسب شغله`;
    }
  } else {
    onboarding = `نوع شغل المستخدم: ${userWorkType || "غير محدد"}`;
  }

  // اجلب الإحصائيات
  let context = "لا توجد بيانات بعد — هذا مستخدم جديد";
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
          const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, a]) => c + ": " + a).join("، ");
          const recent = txs.slice(0, 5).map((t: any) => (t.type === "income" ? "+ دخل" : "- مصروف") + " " + t.amount + " " + t.category).join("\n");

          context = "الرصيد: " + balance + " جنيه\n" +
            "ملاحظة مهمة: الرصيد = الدخل ناقص المصروفات. لو الرقم سالب يعني المستخدم صرف أكتر من دخله\n" +
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

  // بناء البرومبت
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
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages, temperature: 0.8, max_tokens: 300 }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { reply: content, transaction: null }; }

    // احفظ المعاملة
    if (parsed.transaction && userId) {
      const t = parsed.transaction;
      const admin = getAdminClient();
      if (admin) await admin.from("transactions").insert({
        user_id: userId, type: t.type, amount: Number(t.amount), category: t.category || "أخرى",
        main: t.main || "personal", method: t.method || "unknown", note: t.note || message,
      });
    }

    // حدّث الملف الشخصي (اسم أو نوع شغل)
    if (parsed.profile_update && userId) {
      const admin = getAdminClient();
      if (admin) {
        const update: any = {};
        if (parsed.profile_update.name) update.name = parsed.profile_update.name;
        if (parsed.profile_update.work_type) update.work_type = parsed.profile_update.work_type;
        if (Object.keys(update).length > 0) {
          await admin.from("profiles").update(update).eq("id", userId);
        }
      }
    }

    return NextResponse.json({ reply: parsed.reply || "تمام", transaction: parsed.transaction || null });
  } catch {
    const p = parseTransaction(message);
    return NextResponse.json({ reply: p ? "سجّلتها يا " + userName + " ✅" : "جرّب مرة ثانية 🙏", transaction: p });
  }
}
