-- جدول وسائل الدفع المسجّلة لكل مستخدم
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('vodafone_cash','instapay','other')),
  identifier text not null,  -- رقم المحفظة / IPA / رابط
  display_name text,
  is_primary boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, method, identifier)
);

create index if not exists pm_user_idx on public.payment_methods(user_id);

alter table public.payment_methods enable row level security;

create policy "قراءة وسائلي" on public.payment_methods
  for select using (auth.uid() = user_id);
create policy "إضافة وسيلة" on public.payment_methods
  for insert with check (auth.uid() = user_id);
create policy "تعديل وسائلي" on public.payment_methods
  for update using (auth.uid() = user_id);
create policy "حذف وسائلي" on public.payment_methods
  for delete using (auth.uid() = user_id);
