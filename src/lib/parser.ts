// مُحلّل اللغة العربية للمصروفات والدخل
// تطبيع النص + مطابقة أنماط مرنة

import type { Proposal, TxType, PaymentMethod, MainCategory } from './types';

export function normalize(s: string): string {
  return s
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function extractAmount(s: string): number | null {
  const norm = normalize(s);
  const arabicDigits = norm.replace(/[٠-٩]/g, d =>
    String(d.charCodeAt(0) - 1632)
  );
  const m = arabicDigits.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const amount = Number(m[1].replace(',', '.'));
  return isNaN(amount) ? null : amount;
}

const CATEGORY_RULES: { category: string; keywords: string[]; main?: MainCategory }[] = [
  { category: 'مواصلات', keywords: ['بنزين', 'وقود', 'ماطور', 'مواصل', 'تاكسي', 'اوبر', 'كرين', 'سياره', 'مترو', 'اتوبيس', 'باص', 'كراج', 'صيانه', 'زيت', 'سير', 'برايم'] },
  { category: 'فواتير', keywords: ['كهرب', 'مياه', 'ماء', 'غاز', 'انترنت', 'نت', 'فاتوره', 'تليفون', 'موبايل', 'شحن', 'اشتراك', 'شهر'] },
  { category: 'طعام وشراب', keywords: ['غداء', 'غدا', 'اكل', 'ماكله', 'مطعم', 'طعام', 'فطور', 'عشاء', 'عشا', 'قهوه', 'شاي', 'عصير', 'حليب', 'خبز', 'عيش', 'سوق', 'بقاله', 'سوبرماركت', 'تموين'] },
  { category: 'تسوق', keywords: ['ملابس', 'قميص', 'بنطلون', 'بنتالون', 'حذاء', 'جزمة', 'كوتشي', 'مول', 'متجر', 'محل', 'شراء', 'اشتريت', 'مشترو'] },
  { category: 'صحة', keywords: ['دوا', 'دواء', 'صيدليه', 'دكتور', 'طبيب', 'مستشفى', 'مستشفي', 'تحليل', 'اشعه', 'عياده', 'علاج', 'طوارئ'] },
  { category: 'تعليم', keywords: ['كتاب', 'كراسه', 'دفتر', 'مدرسه', 'جامعه', 'كورس', 'دوره', 'محاضره', 'رسوم', 'تسجيل', 'امتحان'] },
  { category: 'ترفيه', keywords: ['سينما', 'فل', 'فيلم', 'بلايستيشن', 'لعبه', 'العاب', 'كافيه', 'نادي', 'نادى', 'جيم', 'رياضه'] },
  { category: 'إيجار', keywords: ['ايجار', 'إيجار', 'بقاء', 'سكن', 'شقه'] },
];

const INCOME_KEYWORDS: string[] = [
  'حصلت', 'قبلت', 'استلمت', 'راتب', 'مرتب', 'دخل', 'ارباح', 'ربح', 'مكسب',
  'تحويل', 'حولو', 'استلم', 'سلمو', 'دفو', 'دفعو', 'عموله', 'عمولة',
  'مكافاه', 'هديه', 'هدية', 'صرفو', 'استرجاع', 'مردود', 'بونص', 'بيريم',
];

const METHOD_RULES: { method: PaymentMethod; keywords: string[] }[] = [
  { method: 'cash', keywords: ['كاش', 'نقد', 'نقدي', 'فلوس', 'جنيه'] },
  { method: 'card', keywords: ['كارت', 'بطاقه', 'فيزا', 'ماستركارد', 'ماستر', 'صراف', 'اتم', 'ماكينه'] },
  { method: 'wallet', keywords: ['محفظه', 'فودافون', 'فازا', 'اتصالات', 'اورانج', 'انسطامبي', 'انسجامبي'] },
  { method: 'bank', keywords: ['تحويل', 'حواله', 'بنك', 'حساب', 'اوبن'] },
];

function detectType(s: string): TxType {
  const n = normalize(s);
  for (const k of INCOME_KEYWORDS) {
    if (n.includes(normalize(k))) return 'income';
  }
  if (/^استلمت|^حصلت|^قبضت|^اخدت راتب|^وصلني/.test(n)) return 'income';
  return 'expense';
}

function detectCategory(s: string): { category: string; main: MainCategory } {
  const n = normalize(s);
  if (/(عمال|عامل|اجور|اجور|رواتب|مرتب|شغل|عمل)/.test(n)) {
    if (/(غداء|غدا|اكل)/.test(n)) return { category: 'غداء العمال', main: 'work' };
    if (/(اجر|اجور|عامل|عاملة)/.test(n)) return { category: 'أجور العمال', main: 'work' };
    return { category: 'مصروفات عمل', main: 'work' };
  }
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(normalize(kw))) {
        return { category: rule.category, main: rule.main || 'personal' };
      }
    }
  }
  return { category: 'أخرى', main: 'personal' };
}

function detectMethod(s: string): PaymentMethod {
  const n = normalize(s);
  for (const rule of METHOD_RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(normalize(kw))) return rule.method;
    }
  }
  return 'unknown';
}

export function parseTransaction(input: string): Proposal | null {
  const amount = extractAmount(input);
  if (amount === null || amount <= 0) return null;

  const type = detectType(input);
  const { category, main } = detectCategory(input);
  const method = detectMethod(input);

  return {
    type,
    amount,
    category,
    main,
    method,
    note: input.trim(),
  };
}

export function formatProposal(p: Proposal): string {
  const action = p.type === 'income' ? 'وارد' : 'مصروف';
  const methodLabel: Record<PaymentMethod, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    wallet: 'محفظة إلكترونية',
    bank: 'تحويل بنكي',
    unknown: 'غير محدد',
  };
  return `فهمت أنك تريد تسجيل ${action} بقيمة ${p.amount.toLocaleString('ar-EG')} جنيه.\nالفئة: ${p.category}\nطريقة الدفع: ${methodLabel[p.method]}`;
}
