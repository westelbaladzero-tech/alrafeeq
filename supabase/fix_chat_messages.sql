-- إنشاء/إصلاح تخزين المحادثات السحابي للمستخدمين
-- شغّل هذا الملف مرة واحدة فقط إذا احتجته يدويًا

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','bot')),
  text text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "قراءة رسائل المستخدم" on public.chat_messages
  for select using (auth.uid() = user_id);

create policy "إضافة رسائل المستخدم" on public.chat_messages
  for insert with check (auth.uid() = user_id);

create policy "حذف رسائل المستخدم" on public.chat_messages
  for delete using (auth.uid() = user_id);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages(user_id, created_at);
