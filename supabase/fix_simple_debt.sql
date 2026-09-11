-- ============================================================
-- إصلاح الدين البسيط — الرفيق الأمين
-- ينفّذ: 11 سبتمبر 2026
-- المبدأ: تتبع التسديد + منع التجاوز + اكتمال تلقائي
-- ============================================================

-- 1) إضافة عمود settled_amount لتتبع كم اتسدد فعلياً
alter table public.debt_requests
  add column if not exists settled_amount numeric default 0;

-- 2) إضافة عمود completed_at
alter table public.debt_requests
  add column if not exists completed_at timestamptz;

-- 3) دالة ذرّية لتسجيل تسديد الدين البسيط
--    تمنع التجاوز: LEAST + WHERE settled < amount
create or replace function public.settle_simple_debt(
  p_debt_id uuid,
  p_amount numeric
) returns boolean as $$
begin
  update public.debt_requests
  set settled_amount = least(
    coalesce(settled_amount, 0) + p_amount,
    amount
  )
  where id = p_debt_id
    and coalesce(settled_amount, 0) < amount;
  return found;
end;
$$ language plpgsql security definer;

-- 4) قفل الصلاحيات
revoke execute on function public.settle_simple_debt(uuid, numeric)
  from anon, authenticated, public;

-- 5) تريغر لتسديد الدين البسيط عند تأكيد التسوية المرتبطة
--    يشتغل بس للديون غير المقسّطة (is_installment = false)
create or replace function public.handle_simple_debt_on_settlement()
returns trigger as $$
declare
  v_debt record;
begin
  if NEW.status = 'confirmed' and (OLD.status is distinct from 'confirmed') then
    if NEW.linked_debt_id is not null then
      select id, amount, is_installment, settled_amount
      into v_debt
      from public.debt_requests
      where id = NEW.linked_debt_id;

      -- فقط للدين البسيط (غير مقسّط)
      if v_debt.is_installment = false
         and coalesce(v_debt.settled_amount, 0) < v_debt.amount then

        perform public.settle_simple_debt(
          v_debt.id,
          NEW.amount
        );
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- 6) ربط التريغر بجدول التسويات
drop trigger if exists simple_debt_settlement_trigger on public.settlements;
create trigger simple_debt_settlement_trigger
  after update on public.settlements
  for each row execute function public.handle_simple_debt_on_settlement();

-- 7) تحديث دالة الاكتمال لتشمل الدين البسيط
create or replace function public.check_debt_completion()
returns trigger as $$
begin
  -- الأقساط: paid = total
  if NEW.is_installment = true
     and NEW.paid_installments is not null
     and NEW.total_installments is not null
     and NEW.paid_installments >= NEW.total_installments
     and NEW.status = 'confirmed' then
    update public.debt_requests
    set status = 'completed', completed_at = now()
    where id = NEW.id;
  end if;

  -- الدين البسيط: settled >= amount
  if NEW.is_installment = false
     and NEW.settled_amount is not null
     and NEW.amount is not null
     and NEW.settled_amount >= NEW.amount
     and NEW.status = 'confirmed' then
    update public.debt_requests
    set status = 'settled', completed_at = now()
    where id = NEW.id;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;
