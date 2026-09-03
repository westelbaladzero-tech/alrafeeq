import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { parseTransaction } from "@/lib/parser";
import { trackUsage } from "@/lib/usage";

const GROQ_KEY = process.env.GROQ_API_KEY;

// Gemini co-pilot — مساعد خفي للتحليل المالي
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const ANALYSIS_KEYWORDS = ["تقرير", "أكتر", "أنهى", "تحليل", "نصيحة", "إيه اللي", "صرفت كام",
  "أكثر", "ملخص", "إحصائيات", "نمط", "أنماط", "ليه", "نصائح", "ميزانية", "كم صرفت", "فين فلوس",
  "رصيده", "ليا كام", "عليا كام", "وضع", "حال",
  "ليك", "عليك", "صاحب", "صديق", "جمعية", "أقساط", "دين", "تسوية", "رصيد الأصدقاء", "حسابات الأصدقاء"];

function needsGeminiAnalysis(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return ANALYSIS_KEYWORDS.some(kw => lower.includes(kw));
}

function extractGeminiText(payload: any): string {
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

async function getGeminiInsights(message: string, context: string): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  try {
    const res = await fetch(GEMINI_URL, {
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
            text: `أنت محلل مالي ذكي. حلل البيانات المالية التالية وأجب عن سؤال المستخدم برؤى ونصائح مفيدة بالعربية المصرية العامية.\n\nسؤال المستخدم: ${message}\n\nالبيانات المالية:\n${context}\n\nقدم تحليل مختصر ومفيد: أنماط الإنفاق، نصائح عملية، ملاحظات مهمة. كن مختصرًا ودقيقًا. الأرقام بالأرقام وليس بالحروف.`,
          },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) return "";
    return extractGeminiText(data).trim();
  } catch {
    return "";
  }
}

// كلمات تدل على أن Groq لم يفهم الرسالة
const CONFUSED_KEYWORDS = ["ما فهمت", "ما قدرتش", "تقدر توضح", "تقدر تعيد", "معلش، ما", "مش واضح", "مش قادر أفهم", "وضّح", "كرر", "جرّب مرة"];

function isConfusedResponse(reply: string): boolean {
  if (!reply) return false;
  const lower = reply.toLowerCase();
  return CONFUSED_KEYWORDS.some(kw => lower.includes(kw));
}

// Gemini فهم عميق للرسائل الغامضة
async function getGeminiUnderstanding(message: string, context: string, history: any[]): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  try {
    const recentHistory = history.slice(-4).map((h: any) => `${h.role === "user" ? "المستخدم" : "الرفيق"}: ${h.text}`).join("\n");
    const res = await fetch(GEMINI_URL, {
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
            text: `أنت مساعد ذكي تفهم العامية المصرية. المستخدم أرسل رسالة غامضة لم يفهمها المساعد الأول. حلّل الرسالة في سياق المحادثة والبيانات المالية، ووضّح ما يقصده المستخدم على الأرجح.\n\nرسالة المستخدم: ${message}\n\nسياق المحادثة:\n${recentHistory}\n\nالبيانات المالية:\n${context}\n\nماذا يقصد المستخدم على الأرجح؟ اشرح باختصار ووضّح القصد. إذا كان يسأل عن معاملات سابقة، اذكرها. إذا كان يسأل عن رصيد، وضّح ذلك.`,
          },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) return "";
    return extractGeminiText(data).trim();
  } catch {
    return "";
  }
}

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
- الأسئلة القصيرة المصرية (افهمها صح):
  "ليا كام" أو "كم لي" أو "كم باقي" = يسأل عن رصيده → جاوب: "لك X جنيه"
  "عليا كام" = يسأل كم عليه → جاوب: "عليك X جنيه"
- ما تقول "معاك" — قول "لك" دائماً
- ما ترد "تمام" لو سُئلت عن رصيد أو مبلغ
- ما فهمت: اسأل ببساطة

{onboarding}

{geminiInsights}

قواعد مهمة جداً:
- ما تقول "تم تسجيل" أو "تم اعتماد" — لغة روبوت
- قول "سجّلتها" أو "تمام" بطبيعية
- ناده باسمه أحياناً
- في حساب الرصيد: الدخل ناقص المصروفات. لو سالب قول "عليك"
- أكمل إجاباتك دائماً — ما تقصها في النص
- لو سأل عن شخص، راجع بيانات الحسابات في السياق قبل الجواب
- لو قال المستخدم "اكمل" أو "كم"، ارجع لآخر معاملة وكمّل منها
- ما تنسى شي قاله في نفس المحادثة — راجع التاريخ المقدم
- مهم جداً: لو سُئلت أي سؤال (عن رصيد، شخص، مبلغ، تقرير) — ما ترد "تمام" أبداً! لازم تجاوب بالإجابة كاملة. "تمام" فقط لتأكيد التسجيل بعد معاملة
- لو سأل "ليا كام عند فلان؟" ابحث عن اسم فلان في بيانات الحسابات المقدمة بالسياق وجاوب: "لك X جنيه من فلان"

قواعد إخراج JSON:
- أرجع JSON صالح فقط — بدون أي نص قبله أو بعده
- بدون علامات تنسيق json أو اقواس مزدوجة
- الـ reply فيها النص الطبيعي بس — بدون JSON أو كود
- لو الجواب طويل، خليه كامل في reply

بيانات {userName} المالية:
{context}

طرق الدفع — ميّز تلقائياً:
- "كاش/نقدي/جيبة" → cash
- "فيزا/كارت/بطاقة" → card  
- "فودافون كاش/اتصالات كاش/أورانج كاش/محفظة" → wallet
- "تحويل/بنك/حساب" → bank
- لو ما ذكر → unknown

الفئات الأساسية: مطاعم، مواصلات، فواتير، تسوق، صحة، تعليم، ترفيه، إيجار، راتب، أرباح، عمولة، أخرى
فئات المستخدم المخصصة: {customCats}

إدارة الفئات:
- لو طلب المستخدم إضافة فئة جديدة (مثل "أضف فئة قهوة")، استخدم category_update: {"action": "add", "category": "قهوة"}
- لو طلب حذف فئة (مثل "احذف فئة ترفيه")، استخدم category_update: {"action": "delete", "category": "ترفيه"}
- بعد الإضافة/الحذف، أكد للمستخدم بالعامية
- استخدم الفئات المخصصة في المعاملات لو ناسبت

تتبع الأشخاص (مهم جداً):
- لو ذكر المستخدم شخص مع مبلغ، استخرج اسمه كامل في transaction.person
  مثل: "محمد هاني أخذ ٥٠٠" → person: "محمد هاني"
  مثل: "أحمد سعد دفع ٢٠٠" → person: "أحمد سعد"

اتجاه الدين (افهم العامية المصرية صح):
- "ليا عند فلان X" = فلان عليه لك X = الشخص مديون لك → type: expense، وقل "لك X جنيه من فلان"
- "فلان عليه X" أو "فلان معاه X" = الشخص عليه لك → type: expense، وقل "لك X"
- "أنا عليّ لفلان X" أو "أنا مديون لفلان X" = انت عليه لفلان → type: income، وقل "عليك X"
- "أخذ/استلف/أعطيته/سلفته X" = الشخص أخذ منك → type: expense، وقل "لك X عند فلان"
- "دفع/رجع/سدد/رد" = الشخص رد دينه → type: income، وقل "فلان رد لك X"

مهم جداً:
- "ليا عند فلان" تعني فلان مديون لك (لك، مو عليك)
- "عليّ لفلان" تعني انت مديون لفلان (عليك)
- لو سالب يعني عليك، لو موجب يعني لك
- لو سأل "ليا كام عند فلان؟" أو "كم له عندي؟" جاوب: "لك X جنيه من فلان" (لو موجب)
- لو سأل "عليا كام لفلان؟" جاوب: "عليك X جنيه لفلان" (لو سالب)
- مهم جداً: استخدم "لك" لو هو مديون لك، و"عليك" لو انت مديون له
- ما تقولش "عندك" — قول "لك" أو "عليك" حسب الاتجاه
- لو سأل عن شخص بالاسم، جاوبه من بيانات الحسابات المقدمة في السياق
- لا تسجل معاملة شخص تحت فئة "أخرى" — استخدم "عمولة"

حسابات الأصدقاء (مهم جداً):
- لو سأل "كم ليك عند الناس؟" أو "حسابات الأصدقاء؟" — اعرض الأرصدة من قسم "═══ حسابات الأصدقاء ═══" في السياق
- لو سأل عن صديق محدد — ابحث في بيانات الأصدقاء في السياق
- لو سأل عن "الجمعية" — اعرض حالة الجمعية من السياق
- لو سأل عن "الأقساط" — اعرض حالة الأقساط
- لو سأل عن "طلبات معلّقة" — اعرضها من السياق
- "صافي رصيدك مع الأصدقاء" = الإجمالي ليك ناقص الإجمالي عليك من قسم حسابات الأصدقاء
- لو لم يوجد قسم "═══ حسابات الأصدقاء ═══" في السياق → ليس لديه أصدقاء بعد

أرجع JSON بهذا الشكل بالظبط:
{"transaction": {"type": "expense|income", "amount": 0, "category": "", "main": "personal|work", "method": "cash|card|wallet|bank|unknown", "person": "اسم الشخص أو null", "note": ""} أو null، "profile_update": {"name": ""} أو {"work_type": ""} أو null، "category_update": {"action": "add|delete", "category": ""} أو null، "reply": "ردك هنا"}`;

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
  return { reply: cleaned.replace(/[{}"\[\]]/g, "").replace(/transaction|profile_update|reply|type|amount|category|main|method|note|name|work_type|null/g, "").trim() || "معلش، ما فهمت. تقدر توضح أكتر؟ 🙏", transaction: null, profile_update: null };
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
  let customCats: string[] = [];
  let needsOnboarding = false;
  let onboardingStep = "";

  if (userId) {
    const admin = getAdminClient();
    if (admin) {
      const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (profile) {
        if (profile.name) userName = profile.name;
        if (profile.work_type) userWorkType = profile.work_type;
        if (profile.custom_categories) customCats = profile.custom_categories;
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

          // بيانات الأشخاص
          const personTxs = txs.filter((x: any) => x.person);
          let personData = "";
          if (personTxs.length > 0) {
            const personMap: Record<string, { gave: number; received: number }> = {};
            for (const t of personTxs) {
              if (!personMap[t.person]) personMap[t.person] = { gave: 0, received: 0 };
              if (t.type === "expense") personMap[t.person].gave += Number(t.amount);
              else personMap[t.person].received += Number(t.amount);
            }
            personData = "\nالحسابات بينك وبين الناس:\n" + Object.entries(personMap).map(([name, d]) => {
              const net = d.gave - d.received;
              return name + ": " + (net > 0 ? "لك " + Math.abs(net) + " جنيه (هو مديون لك)" : "عليك " + Math.abs(net) + " جنيه (انت مديون له)");
            }).join("\n");
          }
          context = "الرصيد: " + balance + " جنيه (الرصيد = الدخل ناقص المصروفات، لو سالب يعني صرف أكتر من دخله)\n" +
            "إجمالي الدخل: " + income + "\nإجمالي المصروفات: " + expense + "\n" +
            "أعلى الفئات: " + (topCats || "لا يوجد") + "\nآخر المعاملات:\n" + recent + personData;
        }

        // ─── بيانات الأصدقاء والديون ───
        const { data: ships } = await admin.from("friendships")
          .select("id, user_a, user_b, status, relationship_type, gam3eya_total, gam3eya_completed, gam3eya_my_turn, gam3eya_amount, gam3eya_role")
          .or("user_a.eq." + userId + ",user_b.eq." + userId)
          .eq("status", "accepted");

        if (ships && ships.length > 0) {
          let friendsContext = "\n\n═══ حسابات الأصدقاء ═══\n";
          let totalOwed = 0, totalOwe = 0;

          for (const ship of ships) {
            const friendId = ship.user_a === userId ? ship.user_b : ship.user_a;
            const { data: friendProfile } = await admin.rpc("get_friend_profile", { friend_id: friendId });
            const friendName = (friendProfile && friendProfile.length > 0) ? friendProfile[0].phone : "غير معروف";
            const relLabel = ({ friend: "صديق", employer: "صاحب عمل", colleague: "أعمل مع", partner: "شريك", client: "عميل", association: "جمعية" } as Record<string, string>)[ship.relationship_type || "friend"] || "صديق";

            // حساب الرصيد
            const { data: myDebts } = await admin.from("debt_requests").select("amount").eq("creditor", userId).eq("debtor", friendId).eq("status", "confirmed");
            const owed = (myDebts || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
            const { data: theirDebts } = await admin.from("debt_requests").select("amount").eq("creditor", friendId).eq("debtor", userId).eq("status", "confirmed");
            const owe = (theirDebts || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
            const { data: mySett } = await admin.from("settlements").select("amount").eq("from_user", userId).eq("to_user", friendId).eq("status", "confirmed");
            const paid = (mySett || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
            const { data: theirSett } = await admin.from("settlements").select("amount").eq("from_user", friendId).eq("to_user", userId).eq("status", "confirmed");
            const received = (theirSett || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
            const bal = (owed - paid) - (owe - received);

            if (bal > 0) totalOwed += bal;
            else if (bal < 0) totalOwe += Math.abs(bal);

            friendsContext += friendName + " (" + relLabel + "): ";
            if (bal > 0) friendsContext += "ليك " + bal + " جنيه";
            else if (bal < 0) friendsContext += "عليك " + Math.abs(bal) + " جنيه";
            else friendsContext += "الحساب مسوّى";

            // حالة الجمعية
            if (ship.relationship_type === "association" && ship.gam3eya_total) {
              friendsContext += " — جمعية: " + (ship.gam3eya_completed || 0) + "/" + ship.gam3eya_total + " منقضي";
              if (ship.gam3eya_role === "manager") friendsContext += " (أنت المدير)";
              else if (ship.gam3eya_my_turn) friendsContext += " (دورك: " + ship.gam3eya_my_turn + ")";
            }

            // الأقساط
            const { data: installments } = await admin.from("debt_requests")
              .select("amount, total_installments, paid_installments, installment_amount")
              .eq("creditor", userId).eq("debtor", friendId).eq("is_installment", true).eq("status", "confirmed");
            for (const inst of installments || []) {
              friendsContext += "\n  ↳ أقساط: " + inst.amount + " جنيه، " + (inst.paid_installments || 0) + "/" + inst.total_installments + " مسدّد";
            }
            friendsContext += "\n";
          }

          // الطلبات المعلّقة
          const { data: pendingDebts } = await admin.from("debt_requests")
            .select("amount, creditor, debtor, description").eq("status", "pending")
            .or("creditor.eq." + userId + ",debtor.eq." + userId);
          if (pendingDebts && pendingDebts.length > 0) {
            friendsContext += "\nطلبات معلّقة: " + pendingDebts.length + "\n";
            for (const d of pendingDebts) {
              const isCreditor = d.creditor === userId;
              friendsContext += "  ↳ " + (isCreditor ? "ليك " : "عليك ") + d.amount + " جنيه" + (d.description ? " — " + d.description : "") + "\n";
            }
          }

          const { data: pendingSetts } = await admin.from("settlements")
            .select("amount, from_user, to_user").eq("status", "pending")
            .or("from_user.eq." + userId + ",to_user.eq." + userId);
          if (pendingSetts && pendingSetts.length > 0) {
            friendsContext += "\nتسويات معلّقة: " + pendingSetts.length + "\n";
            for (const s of pendingSetts) {
              const isSender = s.from_user === userId;
              friendsContext += "  ↳ " + (isSender ? "دفعت " : "استلمت ") + s.amount + " جنيه\n";
            }
          }

          friendsContext += "\nالإجمالي: ليك " + totalOwed + " جنيه، عليك " + totalOwe + " جنيه";
          friendsContext += " → صافي: " + (totalOwed - totalOwe >= 0 ? "+" : "") + (totalOwed - totalOwe) + " جنيه";

          context += friendsContext;
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

  // Gemini co-pilot: تحليل ذكي للاستفسارات المعقدة
  let geminiInsights = "";
  if (needsGeminiAnalysis(message) && context !== "لا توجد بيانات بعد — مستخدم جديد") {
    geminiInsights = await getGeminiInsights(message, context);
    if (geminiInsights) {
      geminiInsights = `تحليل إضافي من المساعد المالي:\n${geminiInsights}\n\nاستخدم هذا التحليل لإثراء ردك بنصائح ورؤى مفيدة، لكن تكلم بأسلوبك الطبيعي.`;
    }
  }

  const prompt = SYSTEM_PROMPT
    .replace(/\{userName\}/g, userName)
    .replace("{context}", context)
    .replace("{customCats}", customCats.length > 0 ? customCats.join("، ") : "لا توجد بعد")
    .replace("{onboarding}", onboarding)
    .replace("{geminiInsights}", geminiInsights);

  const messages: any[] = [{ role: "system", content: prompt }];
  if (history && Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      messages.push({ role: h.role === "bot" ? "assistant" : "user", content: h.text });
    }
  }
  messages.push({ role: "user", content: message });

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages, temperature: 0.8, max_tokens: 800 }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed = extractJson(content);

    // 🔴 Gemini فهم عميق: لو Groq ما فهمش، Gemini يفهم ويرجع لـ Groq
    if (isConfusedResponse(parsed.reply) && GEMINI_API_KEY && context !== "لا توجد بيانات بعد — مستخدم جديد") {
      const understanding = await getGeminiUnderstanding(message, context, history || []);
      if (understanding) {
        const retryMessages = [...messages];
        retryMessages[retryMessages.length - 1].content = `${message}\n\nملاحظة: المساعد المالي فهم أنك تقصد: ${understanding}. أجب بناءً على هذا الفهم.`;
        try {
          const retryRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": "Bearer " + GROQ_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: retryMessages, temperature: 0.8, max_tokens: 800 }),
          });
          const retryData = await retryRes.json();
          const retryContent = retryData.choices?.[0]?.message?.content || "{}";
          const retryParsed = extractJson(retryContent);
          if (retryParsed.reply && !isConfusedResponse(retryParsed.reply)) {
            parsed = retryParsed;
          }
        } catch {}
      }
    }

    // احفظ المعاملة
    if (parsed.transaction && userId) {
      const t = parsed.transaction;
      const admin = getAdminClient();
      if (admin) await admin.from("transactions").insert({
        user_id: userId, type: t.type, amount: Number(t.amount), category: t.category || "أخرى",
        main: t.main || "personal", method: t.method || "unknown", note: t.note || message,
        person: t.person || null,
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

    // إدارة الفئات المخصصة
    if (parsed.category_update && userId) {
      const admin = getAdminClient();
      if (admin) {
        const cat = parsed.category_update.category;
        const action = parsed.category_update.action;
        if (cat && (action === "add" || action === "delete")) {
          const { data: prof } = await admin.from("profiles").select("custom_categories").eq("id", userId).maybeSingle();
          let cats: string[] = prof?.custom_categories || [];
          if (action === "add" && !cats.includes(cat)) cats.push(cat);
          if (action === "delete") cats = cats.filter((c: string) => c !== cat);
          await admin.from("profiles").update({ custom_categories: cats }).eq("id", userId);
        }
      }
    }

    await trackUsage("groq", "chat", true, userId || undefined);

    return NextResponse.json({ reply: parsed.reply || "معلش، ما قدرتش أفهم. تقدر تعيد السؤال بطريقة تانية؟ 🙏", transaction: parsed.transaction || null, category_update: parsed.category_update || null });
  } catch {
    const p = parseTransaction(message);
    return NextResponse.json({ reply: p ? "سجّلتها يا " + userName + " ✅" : "جرّب مرة ثانية 🙏", transaction: p });
  }
}
