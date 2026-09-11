-- ─── إصلاح ثغرة منطقية في P2P dispute workflow ───
-- ينفّذ: 11 سبتمبر 2026
-- المشكلة: أي طرف يقدر يفتح نزاع ثم يحله بنفسه (accept = refunded)
-- الحل: تسجيل من فتح النزاع + التحقق في resolve

-- أضف عمود لتسجيل من فتح النزاع
ALTER TABLE public.p2p_transactions
  ADD COLUMN IF NOT EXISTS dispute_opened_by uuid;

-- ملاحظة: العمود nullable لأن المعاملات القديمة ما عندها هذا السجل
-- الكود في dispute/resolve يتحقق: IF dispute_opened_by = userId → 403
