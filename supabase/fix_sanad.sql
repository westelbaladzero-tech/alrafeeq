-- ============================================================
-- إصلاح نظام السندات — الرفيق الأمين
-- ينفّذ: 11 سبتمبر 2026
-- المبدأ: تريغر تلقائي + UNIQUE + ترقيم ذرّي + قفل الصلاحيات
-- ============================================================

-- 1) UNIQUE على linked_settlement_id (منع تكرار السند لنفس التسوية)
create unique index if not exists sanad_unique_settlement
  on public.sanad_records (linked_settlement_id)
  where linked_settlement_id is not null;

-- 2) UNIQUE على linked_p2p_id (منع تكرار السند لنفس معاملة P2P)
create unique index if not exists sanad_unique_p2p
  on public.sanad_records (linked_p2p_id)
  where linked_p2p_id is not null;

-- 3) UNIQUE على (friendship_id, sanad_number) لمنع تكرار أرقام السندات
create unique index if not exists sanad_unique_number
  on public.sanad_records (friendship_id, sanad_number);

-- 4) إدراج ذرّي لسند تسوية مع قفل استشاري على مستوى الصداقة
create or replace function public.create_sanad_for_settlement(
  p_settlement_id uuid
) returns boolean as $$
declare
  v_sett public.settlements%rowtype;
  v_sanad_num integer;
  v_type text;
begin
  select * into v_sett
  from public.settlements
  where id = p_settlement_id;

  if not found then
    return false;
  end if;

  if v_sett.status <> 'confirmed' then
    return false;
  end if;

  if v_sett.linked_settlement_id is not null then
    -- لا يوجد هذا العمود؛ guard placeholder removed by design
    null;
  end if;

  -- لو السند موجود أصلاً، لا تكرار
  if exists (
    select 1 from public.sanad_records
    where linked_settlement_id = v_sett.id
  ) then
    return false;
  end if;

  -- قفل استشاري لكل friendship_id لمنع race في sanad_number
  perform pg_advisory_xact_lock(hashtext(v_sett.friendship_id::text));

  select coalesce(max(sanad_number), 0) + 1 into v_sanad_num
  from public.sanad_records
  where friendship_id = v_sett.friendship_id;

  v_type := case coalesce(v_sett.category, 'debt')
    when 'gam3eya' then 'gam3eya_payment'
    when 'installment' then 'installment_payment'
    else 'settlement'
  end;

  insert into public.sanad_records (
    friendship_id, type, category,
    from_user, to_user, amount,
    description, linked_settlement_id,
    status, sanad_number, confirmed_at
  ) values (
    v_sett.friendship_id,
    v_type,
    coalesce(v_sett.category, 'debt'),
    v_sett.from_user,
    v_sett.to_user,
    v_sett.amount,
    v_sett.description,
    v_sett.id,
    'confirmed',
    v_sanad_num,
    now()
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$ language plpgsql security definer;

-- 5) تريغر إنشاء السند عند تأكيد التسوية
drop trigger if exists sanad_settlement_trigger on public.settlements;

create or replace function public.handle_sanad_on_settlement()
returns trigger as $$
begin
  if NEW.status = 'confirmed' and (OLD.status is distinct from 'confirmed') then
    perform public.create_sanad_for_settlement(NEW.id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger sanad_settlement_trigger
  after update on public.settlements
  for each row execute function public.handle_sanad_on_settlement();

-- 6) إدراج ذرّي لسند P2P مع قفل استشاري
create or replace function public.create_sanad_for_p2p(
  p_transaction_id uuid
) returns boolean as $$
declare
  v_txn public.p2p_transactions%rowtype;
  v_sanad_num integer;
begin
  select * into v_txn
  from public.p2p_transactions
  where id = p_transaction_id;

  if not found then
    return false;
  end if;

  if v_txn.status <> 'settled' then
    return false;
  end if;

  if exists (
    select 1 from public.sanad_records
    where linked_p2p_id = v_txn.id
  ) then
    return false;
  end if;

  if v_txn.friendship_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_txn.friendship_id::text));

  select coalesce(max(sanad_number), 0) + 1 into v_sanad_num
  from public.sanad_records
  where friendship_id = v_txn.friendship_id;

  insert into public.sanad_records (
    friendship_id, type, category,
    from_user, to_user, amount,
    description, linked_p2p_id,
    payment_method, receipt_url,
    status, sanad_number, confirmed_at
  ) values (
    v_txn.friendship_id,
    'p2p',
    'debt',
    v_txn.from_user,
    v_txn.to_user,
    v_txn.amount,
    'معاملة ' || coalesce(v_txn.method, 'p2p'),
    v_txn.id,
    v_txn.method,
    v_txn.receipt_url,
    'confirmed',
    v_sanad_num,
    now()
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$ language plpgsql security definer;

-- 7) تريغر إنشاء السند عند اكتمال P2P
drop trigger if exists sanad_p2p_trigger on public.p2p_transactions;

create or replace function public.handle_sanad_on_p2p()
returns trigger as $$
begin
  if NEW.status = 'settled' and (OLD.status is distinct from 'settled') then
    perform public.create_sanad_for_p2p(NEW.id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger sanad_p2p_trigger
  after update on public.p2p_transactions
  for each row execute function public.handle_sanad_on_p2p();

-- 8) قفل الصلاحيات
revoke execute on function public.get_next_sanad_number(uuid)
  from anon, authenticated, public;
revoke execute on function public.create_p2p_sanad(uuid, uuid)
  from anon, authenticated, public;
revoke execute on function public.create_sanad_for_settlement(uuid)
  from anon, authenticated, public;
revoke execute on function public.create_sanad_for_p2p(uuid)
  from anon, authenticated, public;
