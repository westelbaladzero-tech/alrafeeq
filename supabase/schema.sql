-- مخطط قاعدة بيانات الرفيق على Supabase
-- نفّذ هذا الملف في محرر SQL داخل مشروع Supabase الخاص بك

-- جدول المستخدمين (يمكن ربطه بـ auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pin text,
  created_at timestamptz default now()
);

-- جدول العمليات
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('expense','income')),
  amount numeric not null check (amount > 0),
  category text not null,
  main text not null check (main in ('personal','work')),
  method text not null check (method in ('cash','card','wallet','bank','unknown')),
  note text,
  created_at timestamptz default now()
);

-- سياسة أمن مستوى الصفوف (RLS)
alter table public.transactions enable row level security;
alter table public.profiles enable row level security;

-- كل مستخدم يرى عملياته فقط
create policy "قراءة عمليات المستخدم" on public.transactions
  for select using (auth.uid() = user_id);
create policy "إضافة عمليات المستخدم" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "حذف عمليات المستخدم" on public.transactions
  for delete using (auth.uid() = user_id);

create policy "إدارة الملف الشخصي" on public.profiles
  for all using (auth.uid() = id);
