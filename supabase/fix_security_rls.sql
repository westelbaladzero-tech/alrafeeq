-- ─── إصلاح أمني حرج: تفعيل RLS على كل الجداول ───
-- نفّذ هذا فوراً في Supabase SQL Editor

-- 1. رسائل الأصدقاء
alter table public.messages enable row level security;

-- قراءة: فقط أطراف الصداقة
create policy "قراءة رسائلي" on public.messages
  for select to authenticated using (
    friendship_id in (
      select id from public.friendships
      where user_a = auth.uid() or user_b = auth.uid()
    )
  );

-- إضافة: فقط أطراف الصداقة
create policy "إرسال رسالة" on public.messages
  for insert to authenticated with check (
    friendship_id in (
      select id from public.friendships
      where user_a = auth.uid() or user_b = auth.uid()
    )
    and sender_id = auth.uid()
  );

-- تحديث: فقط رسائلك (للقراءة)
create policy "تحديث رسائلي" on public.messages
  for update to authenticated using (sender_id = auth.uid());

-- 2. الصداقات
alter table public.friendships enable row level security;

create policy "قراءة صداقاتي" on public.friendships
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());

create policy "إنشاء صداقة" on public.friendships
  for insert to authenticated with check (user_a = auth.uid() or user_b = auth.uid());

create policy "تحديث صداقتي" on public.friendships
  for update to authenticated using (user_a = auth.uid() or user_b = auth.uid());

-- 3. طلبات الديون
alter table public.debt_requests enable row level security;

create policy "قراءة ديوني" on public.debt_requests
  for select to authenticated using (creditor = auth.uid() or debtor = auth.uid());

create policy "إنشاء طلب دين" on public.debt_requests
  for insert to authenticated with check (creditor = auth.uid() or debtor = auth.uid());

create policy "تحديث طلب دين" on public.debt_requests
  for update to authenticated using (creditor = auth.uid() or debtor = auth.uid());

-- 4. التسويات
alter table public.settlements enable row level security;

create policy "قراءة تسوياتي" on public.settlements
  for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());

create policy "إنشاء تسوية" on public.settlements
  for insert to authenticated with check (from_user = auth.uid() or to_user = auth.uid());

create policy "تحديث تسوية" on public.settlements
  for update to authenticated using (from_user = auth.uid() or to_user = auth.uid());

-- 5. اجعل bucket الملفات خاصاً (ليس عاماً)
update storage.buckets set public = false where id = 'chat-files';

-- احذف السياسات العامة القديمة
drop policy if exists "قراءة ملفات الشات" on storage.objects;

-- سياسة قراءة: فقط أطراف الصداقة
create policy "قراءة ملفات شاتي" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-files'
    and (
      -- الملف في مجلد صداقة أنا طرف فيها
      (storage.foldername(name))[1] in (
        select id::text from public.friendships
        where user_a = auth.uid() or user_b = auth.uid()
      )
    )
  );
