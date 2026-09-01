-- إصلاح جدول profiles ليتوافق مع كود الرفيق الأمين الحالي
-- شغّل هذا الملف مرة واحدة داخل Supabase SQL Editor

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists pin_hash text,
  add column if not exists email_verified boolean default false,
  add column if not exists failed_attempts integer default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists name text,
  add column if not exists work_type text,
  add column if not exists custom_categories text[] default '{}';

create unique index if not exists profiles_email_unique_idx on public.profiles (email) where email is not null;
create unique index if not exists profiles_phone_unique_idx on public.profiles (phone) where phone is not null;

-- لو كان عندك العمود القديم pin وتريد تركه فلا مشكلة، الكود الحالي يعتمد على pin_hash فقط.
