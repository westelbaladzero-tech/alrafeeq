-- ============================================================
-- إصلاح نظام الأقساط — الرفيق الأمين
-- ينفّذ: 11 سبتمبر 2026
-- المبدأ: تريغر تلقائي + قفل الصلاحيات + تحديث حالة الدين عند الاكتمال
-- ============================================================

-- 1) الدالة الذرّية لزيادة الأقساط المدفوعة
--    SECURITY DEFINER: تشتغل بهوية postgres
--    LEAST + WHERE يمنعان التجاوز حتى مع طلبات متزامنة
create or replace function public.increment_paid_installments(
  p_debt_id uuid,
  p_inc_count integer default 1,
  p_max_total integer default 0
) returns void as $$
begin
  update public.debt_requests
  set paid_installments = least(
    (paid_installments + p_inc_count),
    p_max_total
  )
  where id = p_debt_id
    and paid_installments < p_max_total;
end;
$$ language plpgsql security definer;

-- 2) قفل الصلاحيات: service_role + postgres بس
revoke execute on function public.increment_paid_installments(uuid, integer, integer)
  from anon, authenticated, public;

-- 3) دالة فحص وتحديث حالة الدين عند الاكتمال
--    تشتغل تلقائياً بعد كل UPDATE على paid_installments
create or replace function public.check_debt_completion()
returns trigger as $$
begin
  if NEW.paid_installments is not null
     and NEW.total_installments is not null
     and NEW.paid_installments >= NEW.total_installments
     and NEW.status = 'confirmed' then
    update public.debt_requests
    set status = 'completed',
        completed_at = now()
    where id = NEW.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- 4) تريغر لاكتمال الدين
drop trigger if exists debt_completion_trigger on public.debt_requests;
create trigger debt_completion_trigger
  after update on public.debt_requests
  for each row execute function public.check_debt_completion();

-- 5) تريغر لتسديد القسط تلقائياً عند تأكيد التسوية المرتبطة بدين مقسّط
create or replace function public.handle_installment_on_settlement()
returns trigger as $$
declare
  v_debt record;
  v_inc integer;
begin
  if NEW.status = 'confirmed' and (OLD.status is distinct from 'confirmed') then
    if NEW.linked_debt_id is not null then
      select id, paid_installments, total_installments, installment_amount
      into v_debt
      from public.debt_requests
      where id = NEW.linked_debt_id;

      if v_debt.total_installments is not null
         and v_debt.total_installments > 0
         and coalesce(v_debt.paid_installments, 0) < v_debt.total_installments then

        v_inc := 1;
        if v_debt.installment_amount is not null and v_debt.installment_amount > 0 then
          v_inc := least(
            round(NEW.amount / v_debt.installment_amount)::integer,
            v_debt.total_installments - coalesce(v_debt.paid_installments, 0)
          );
          if v_inc < 1 then
            v_inc := 1;
          end if;
        end if;

        perform public.increment_paid_installments(
          v_debt.id,
          v_inc,
          v_debt.total_installments
        );
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- 6) ربط التريغر بجدول التسويات
drop trigger if exists installment_settlement_trigger on public.settlements;
create trigger installment_settlement_trigger
  after update on public.settlements
  for each row execute function public.handle_installment_on_settlement();
