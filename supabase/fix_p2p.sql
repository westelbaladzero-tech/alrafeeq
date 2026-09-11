-- ============================================================
-- إصلاح نظام P2P — الرفيق الأمين
-- ينفّذ: 11 سبتمبر 2026
-- المبدأ: قفل الصلاحيات + إصلاح CHECK constraint + ربط بالتريغرات
-- ============================================================

-- 1) REVOKE من anon + authenticated + PUBLIC على RPCs الخطرة
REVOKE EXECUTE ON FUNCTION public.settle_debt_from_p2p(uuid, numeric, uuid, uuid, uuid)
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.suspend_debt_for_p2p(uuid, numeric)
  FROM anon, authenticated, public;

-- 2) إصلاح CHECK constraint: إضافة refunded + expired
ALTER TABLE public.p2p_transactions DROP CONSTRAINT IF EXISTS p2p_transactions_status_check;
ALTER TABLE public.p2p_transactions ADD CONSTRAINT p2p_transactions_status_check
  CHECK (status IN (
    'initiated', 'awaiting_details', 'pending_payment', 'receipt_uploaded',
    'verifying', 'confirmed', 'disputed', 'settled', 'cancelled',
    'refunded', 'expired'
  ));

-- 3) إعادة تعريف settle_debt_from_p2p — تمرر linked_debt_id + category
--    هذا يربطها بالتريغرات الجديدة بدل تجاوزها
CREATE OR REPLACE FUNCTION public.settle_debt_from_p2p(
  p_debt_id uuid,
  p_settle_amount numeric,
  p_from_user uuid,
  p_to_user uuid,
  p_friendship_id uuid
) RETURNS uuid AS $$
DECLARE
  new_settlement_id uuid;
  v_debt record;
BEGIN
  SELECT amount, is_installment INTO v_debt
  FROM public.debt_requests WHERE id = p_debt_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.settlements (
    from_user, to_user, friendship_id,
    amount, description, status,
    linked_debt_id, category
  ) VALUES (
    p_from_user, p_to_user, p_friendship_id,
    p_settle_amount, 'تسوية تلقائية عبر P2P', 'confirmed',
    p_debt_id,
    CASE WHEN v_debt.is_installment = true THEN 'installment' ELSE 'debt' END
  )
  RETURNING id INTO new_settlement_id;

  RETURN new_settlement_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) قفل الدالة الجديدة
REVOKE EXECUTE ON FUNCTION public.settle_debt_from_p2p(uuid, numeric, uuid, uuid, uuid)
  FROM anon, authenticated, public;
