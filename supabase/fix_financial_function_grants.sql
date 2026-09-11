-- ============================================================
-- تقوية صلاحيات الدوال المالية — الرفيق الأمين
-- ينفّذ: 11 سبتمبر 2026
-- المبدأ: كل دوال المال الداخلية service_role/postgres فقط
-- ============================================================

-- دوال التريغرات المالية
REVOKE EXECUTE ON FUNCTION public.check_debt_completion()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_gam3eya_turn_on_settlement()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_installment_on_settlement()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_sanad_on_p2p()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_sanad_on_settlement()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_simple_debt_on_settlement()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_p2p_timestamp()
  FROM anon, authenticated, PUBLIC;

-- دوال مالية كانت مكشوفة
REVOKE EXECUTE ON FUNCTION public.get_friend_profile(uuid)
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits()
  FROM anon, authenticated, PUBLIC;

-- حالات debt_requests.status المسموح بها
ALTER TABLE public.debt_requests
  ADD CONSTRAINT debt_requests_status_check
  CHECK (status IN (
    'pending', 'confirmed', 'rejected',
    'settled', 'completed', 'p2p_pending'
  ));
