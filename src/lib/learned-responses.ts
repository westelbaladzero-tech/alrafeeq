// @ts-nocheck
// ذاكرة الردود المتعلمة — تنضج مع الوقت

const LEARNED_PREFIX = "alrafeeq_learned_responses_";
const MAX_RESPONSES = 200;
const MATCH_THRESHOLD = 0.3;

interface LearnedResponse {
  q: string;
  a: string;
  keywords: string[];
  used: number;
  saved: string;
}

// كلمات وقفية (لا تُحسب ككلمات مفتاحية)
const STOP_WORDS = new Set([
  "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
  "ما", "ماذا", "كيف", "لماذا", "متى", "أين", "هل", "كم", "أن", "إن",
  "أو", "ثم", "و", "ال", "لا", "نعم", "أنا", "أنت", "نحن",
  "هو", "هي", "هم", "كان", "يكون", "قد", "كل", "بعض", "غير",
  "اليوم", "الآن", "بعد", "قبل", "أكثر", "أقل", "جدا", "جداً",
  "عشان", "عشان", "ليه", "إزاي", "ازاي", "ايه", "إيه", "ده", "دي",
]);

function extractKeywords(text: string): string[] {
  const cleaned = text.replace(/[ًٌٍَُِّْ]/g, "").replace(/[^\u0600-\u06FF\s]/g, " ");
  const words = cleaned.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const keywords = words.map(w => w.replace(/^ال/, ""));
  return [...new Set(keywords)];
}

function similarity(kw1: string[], kw2: string[]): number {
  if (kw1.length === 0 || kw2.length === 0) return 0;
  const s1 = new Set(kw1);
  const s2 = new Set(kw2);
  let common = 0;
  for (const k of s1) if (s2.has(k)) common++;
  const union = s1.size + s2.size - common;
  return union > 0 ? common / union : 0;
}

// أسئلة البيانات المالية (ردودها تتغير — لا تحفظها)
const FINANCIAL_PATTERNS = [
  "صرفت", "رصيد", "رصيدي", "مصروفاتي", "دخلي", "باقي",
  "أنفقت", "صرف", "ميزانيتي", "التزامات",
  "أعطني تقرير", "لخص", "حلل", "ملخص", "تقرير",
  "اشتريت", "دفع", "استلمت", "قبض",
];

export function isFinancialQuestion(q: string): boolean {
  const lower = q.toLowerCase();
  return FINANCIAL_PATTERNS.some(p => lower.includes(p));
}

export function saveLearnedResponse(uid: string, question: string, answer: string): void {
  if (typeof window === "undefined") return;
  if (isFinancialQuestion(question)) return;
  if (!answer || answer.length < 5) return;

  const responses = getLearnedResponses(uid);
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return;

  // لو سؤال مشابه موجود → حدّث الرد
  for (const r of responses) {
    if (similarity(keywords, r.keywords) > 0.6) {
      r.a = answer;
      r.used = 0;
      r.saved = new Date().toISOString();
      localStorage.setItem(LEARNED_PREFIX + uid, JSON.stringify(responses));
      return;
    }
  }

  // أضف جديد
  responses.push({
    q: question,
    a: answer,
    keywords,
    used: 0,
    saved: new Date().toISOString(),
  });

  // حدّد الحجم
  if (responses.length > MAX_RESPONSES) {
    responses.sort((a, b) => b.used - a.used);
    responses.length = MAX_RESPONSES;
  }

  localStorage.setItem(LEARNED_PREFIX + uid, JSON.stringify(responses));
}

export function getLearnedResponses(uid: string): LearnedResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEARNED_PREFIX + uid);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function findLearnedResponse(uid: string, question: string): string | null {
  const responses = getLearnedResponses(uid);
  if (responses.length === 0) return null;

  const keywords = extractKeywords(question);
  if (keywords.length === 0) return null;

  let best: LearnedResponse | null = null;
  let bestScore = 0;

  for (const r of responses) {
    const score = similarity(keywords, r.keywords);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    best.used++;
    localStorage.setItem(LEARNED_PREFIX + uid, JSON.stringify(responses));
    return best.a;
  }

  return null;
}

// ─── ردود البيانات المالية من المحلي ───
function getLocalTxStats(uid: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("alrafeeq_transactions_" + uid);
    if (!raw) return null;
    const txs = JSON.parse(raw);
    if (!Array.isArray(txs)) return null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let income = 0, expense = 0, txCount = 0;
    let todayExpense = 0, todayCount = 0;
    let monthExpense = 0;

    for (const t of txs) {
      const d = new Date(t.createdAt);
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
      txCount++;

      if (d >= todayStart && t.type === "expense") {
        todayExpense += t.amount;
        todayCount++;
      }
      if (d >= monthStart && t.type === "expense") {
        monthExpense += t.amount;
      }
    }

    return {
      income, expense, balance: income - expense, txCount,
      todayExpense, todayCount, monthExpense,
    };
  } catch { return null; }
}

export function tryFinancialReply(uid: string, question: string): string | null {
  const q = question.toLowerCase();
  const stats = getLocalTxStats(uid);
  if (!stats) return null;

  // كم صرفت اليوم؟
  if ((q.includes("صرفت") || q.includes("مصروف")) && (q.includes("اليوم") || q.includes("النهارده"))) {
    if (stats.todayCount === 0) return "مفيش مصروفات لليوم لحد دلوقتي ✅";
    return `اليوم صرفت ${stats.todayExpense} جنيه على ${stats.todayCount} عملية 💸`;
  }

  // كم رصيدي؟
  if (q.includes("رصيد") || q.includes("رصيدي") || q.includes("باقي")) {
    return `رصيدك الحالي: ${stats.balance} جنيه 💰\n(دخل: ${stats.income} · مصروف: ${stats.expense})`;
  }

  // كم صرفت الشهر؟
  if ((q.includes("شهر") || q.includes("شهري")) && (q.includes("صرفت") || q.includes("مصروف") || q.includes("مصاريف"))) {
    return `مصروفات الشهر: ${stats.monthExpense} جنيه 📊\n(إجمالي الدخل: ${stats.income} · إجمالي المصروف: ${stats.expense})`;
  }

  // كم معايا فلوس / رصيد؟
  if (q.includes("معايا") || q.includes("فلوس") || q.includes("ميزانية")) {
    return `رصيدك: ${stats.balance} جنيه 💰\n(دخل: ${stats.income} · مصروف: ${stats.expense})`;
  }

  return null;
}

// ─── محاولة الرد الأوفلاين ───
export function tryOfflineReply(uid: string, question: string): string | null {
  // 1) أسئلة البيانات المالية
  const financial = tryFinancialReply(uid, question);
  if (financial) return financial;

  // 2) الذاكرة المتعلمة
  const learned = findLearnedResponse(uid, question);
  if (learned) return learned;

  // 3) لا يمكن الرد
  return null;
}

export function getLearnedCount(uid: string): number {
  return getLearnedResponses(uid).length;
}
