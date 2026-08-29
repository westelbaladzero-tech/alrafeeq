import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getServerClient } from "@/lib/supabase-server";
import { parseTransaction } from "@/lib/parser";

const GROQ_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `أنت الرفيق — صديق أمين يساعد المستخدم في إدارة مصروفاته الشخصية.
تتكلم بالعربية بطبيعية وود. ردودك قصيرة وودودة كأنك صديق حقيقي.

بيانات المستخدم الحالية:
{context}

قواعدك:
1. إذا ذكر المستخدم مبلغاً مع إنفاق أو دخل، استخرجه كمعاملة
2. رد بأسلوب طبيعي مختصر
3. إذا سأل عن رصيده أو إحصائياته، استخدم البيانات المقدمة
4. انصح بذكاء خفيف بدون إلحاح
5. استخدم العملة المذكورة أو "جنيه" افتراضياً

الفئات المتاحة: مطاعم، مواصلات، فواتير، تسوق، صحة، تعليم، ترفيه، إيجار، راتب، أرباح، عمولة، أخرى

أرجع JSON فقط بهذا الشكل:
{"transaction": {"type": "expense|income", "amount": رقم, "category": "فئة", "main": "personal|work", "method": "cash|card|wallet|bank|unknown", "note": "ملاحظة قصيرة"} أو null، "reply": "ردك الطبيعي"}`;

export async function POST(req: NextRequest) {
  const { message, accessToken } = await req.json();
  if (!message) return NextResponse.json({ error: "رسالة فارغة" }, { status: 400 });

  const sb = getServerClient();
  if (!sb) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  let userId: string | null = null;
  if (accessToken) {
    const { data: { user } } = await sb.auth.getUser(accessToken);
    userId = user?.id || null;
  }

  // اجلب إحصائيات المستخدم
  let context = "لا توجد بيانات بعد";
  if (userId) {
    try {
      const admin = getAdminClient();
      if (admin) {
        const { data: txs } = await admin
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (txs && txs.length > 0) {
          const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const balance = income - expense;
          const recent = txs.slice(0, 5).map((t: any) => "- " + (t.type === "income" ? "دخل" : "مصروف") + " " + t.amount + " " + t.category).join("\n");
          context = "الرصيد: " + balance + "\nإجمالي الدخل: " + income + "\nإجمالي المصروفات: " + expense + "\nآخر المعاملات:\n" + recent;
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
      ? "تمام، سجّلت " + (p.type === "income" ? "دخل" : "مصروف") + " " + p.amount + " — " + p.category + " 👌"
      : "ما فهمت المبلغ. جرّب: صرفت ٥٠ على غداء";
    return NextResponse.json({ reply, transaction: p });
  }

  // استدعاء Groq
  try {
    const prompt = SYSTEM_PROMPT.replace("{context}", context);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 400,
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

    return NextResponse.json({ reply: parsed.reply || "تم", transaction: parsed.transaction || null });
  } catch {
    // fallback للمحلل المحلي
    const p = parseTransaction(message);
    const reply = p
      ? "سجّلت " + p.amount + " على " + p.category + " ✅"
      : "صار خطأ. جرّب مرة ثانية";
    return NextResponse.json({ reply, transaction: p });
  }
}
