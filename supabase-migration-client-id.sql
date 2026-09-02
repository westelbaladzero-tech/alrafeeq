-- إضافة عمود client_id لجدول profiles
-- معرف فريد لكل مستخدم، يُنشأ عند إنشاء الحساب

-- أضف العمود إن لم يكن موجودًا
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_id UUID;

-- فعّل إعدادات الأمان
-- client_id يمكن أن يكون NULL للمستخدمين القدامى (التوافقية الراجعة)
-- المستخدمون الجدد سيحصلون على client_id تلقائيًا عند إنشاء الحساب

-- ملء المستخدمين القدامى بمعرفات فريدة
UPDATE profiles 
SET client_id = gen_random_uuid() 
WHERE client_id IS NULL;

-- أضف فهرسًا للبحث السريع
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);
