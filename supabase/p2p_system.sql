-- ============================================================
-- نظام P2P بين الأصدقاء — الرفيق الأمين
-- ينفّذ: 8 سبتمبر 2026
-- المبدأ: المال يتحرك خارجياً، نحن ننظّم ونوثّق
-- ============================================================

-- 1) جدول معاملات P2P
create table if not exists public.p2p_transactions (
  id uuid primary key default gen_random_uuid(),
  -- الطرفان
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  friendship_id uuid,
  -- المبلغ
  amount numeric not null check (amount > 0),
  currency text default 'EGP',
  -- وسيلة الدفع
  method text not null check (method in ('vodafone_cash','instapay','other')),
  -- الحالة
  status text not null default 'initiated'
    check (status in (
      'initiated',
      'awaiting_details',
      'pending_payment',
      'receipt_uploaded',
      'verifying',
      'confirmed',
      'disputed',
      'settled',
      'cancelled'
    )),
  -- ربط بالدين
  debt_request_id uuid,
  settle_amount numeric,
  -- الإيصال
  receipt_url text,
  receipt_data jsonb,
  -- السند
  sanad_message_id uuid,
  -- المهلة الزمنية
  expires_at timestamptz,
  -- التحكيم
  dispute_reason text,
  dispute_resolution text,
  dispute_resolved_by text,
  -- الطوابع الزمنية
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  settled_at timestamptz,
  cancelled_at timestamptz
);

-- فهارس
create index if not exists p2p_from_user_idx on public.p2p_transactions(from_user);
create index if not exists p2p_to_user_idx on public.p2p_transactions(to_user);
create index if not exists p2p_status_idx on public.p2p_transactions(status);
create index if not exists p2p_debt_idx on public.p2p_transactions(debt_request_id);
create index if not exists p2p_created_idx on public.p2p_transactions(created_at desc);

-- 2) سياسة RLS
alter table public.p2p_transactions enable row level security;

create policy "قراءة معاملاتي P2P" on public.p2p_transactions
  for select using (
    auth.uid() = from_user or auth.uid() = to_user
  );

create policy "بدء معاملة P2P" on public.p2p_transactions
  for insert with check (auth.uid() = from_user);

create policy "تعديل معاملة P2P" on public.p2p_transactions
  for update using (
    auth.uid() = from_user or auth.uid() = to_user
  );

-- 3) تريغر لتحديث updated_at
create or replace function public.update_p2p_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  if new.status = 'settled' and old.status <> 'settled' then
    new.settled_at = now();
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists p2p_update_timestamp on public.p2p_transactions;
create trigger p2p_update_timestamp
  before update on public.p2p_transactions
  for each row execute function public.update_p2p_timestamp();

-- 4) دالة لإنشاء سند تلقائي عند التأكيد
create or replace function public.create_p2p_sanad(
  p_transaction_id uuid,
  p_message_id uuid
)
returns void as $$
begin
  update public.p2p_transactions
  set
    status = 'settled',
    sanad_message_id = p_message_id,
    settled_at = now()
  where id = p_transaction_id and status = 'confirmed';
end;
$$ language plpgsql security definer;

-- 5) دالة لتعليق الدين عند بدء P2P
create or replace function public.suspend_debt_for_p2p(
  p_debt_id uuid,
  p_amount numeric
)
returns boolean as $$
declare
  current_status text;
begin
  select status into current_status
  from public.debt_requests
  where id = p_debt_id;

  if current_status = 'confirmed' then
    update public.debt_requests
    set status = 'p2p_pending'
    where id = p_debt_id;
    return true;
  end if;
  return false;
end;
$$ language plpgsql security definer;

-- 6) دالة لتسوية الدين عند اكتمال P2P
create or replace function public.settle_debt_from_p2p(
  p_debt_id uuid,
  p_settle_amount numeric,
  p_from_user uuid,
  p_to_user uuid,
  p_friendship_id uuid
)
returns uuid as $$
declare
  new_settlement_id uuid;
begin
  insert into public.settlements (
    from_user, to_user, friendship_id,
    amount, description, status
  ) values (
    p_from_user, p_to_user, p_friendship_id,
    p_settle_amount, 'تسوية تلقائية عبر P2P', 'confirmed'
  )
  returning id into new_settlement_id;

  update public.debt_requests
  set status = case
    when amount <= p_settle_amount then 'settled'
    else 'confirmed'
  end
  where id = p_debt_id;

  return new_settlement_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- ملاحظات:
-- 1. الجداول جاهزة للتنفيذ في Supabase SQL Editor
-- 2. RLS يضمن أن كل طرف يرى معاملاته فقط
-- 3. الدوال تربط P2P بجدول الديون والتسويات
-- 4. السند = رسالة في جدول messages + رابط في p2p_transactions
-- ============================================================
