-- إضافة دعم الملفات والرسائل الصوتية في شات الأصدقاء
-- نفّذ هذا الملف في Supabase SQL Editor

-- 1. أضف أعمدة الملفات لجدول messages
alter table public.messages
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

-- 2. وسّع نوع الرسالة ليشمل الصور والملفات والصوت
alter table public.messages
  drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check
  check (type in ('text', 'system', 'image', 'file', 'audio'));

-- 3. أنشئ bucket للتخزين (لو مش موجود)
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

-- 4. سياسات التخزين: أي مستخدم مصدق يرفع ويقرأ
create policy "رفع ملفات الشات" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files');

create policy "قراءة ملفات الشات" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-files');
