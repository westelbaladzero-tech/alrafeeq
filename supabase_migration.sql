-- إضافة عمود client_id لجدول profiles
-- شغّل هذا السكربت في Supabase Dashboard → SQL Editor

-- أضف العمود إن لم يكن موجودًا
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_id TEXT;

-- أنشئ فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);

-- اطبع رسالة نجاح
DO $$
BEGIN
  RAISE NOTICE 'تم إضافة عمود client_id بنجاح';
END $$;
