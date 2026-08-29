// عميل Supabase — جاهز للربط عند توفّر المفاتيح
// NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY
// بدون المفاتيح، التطبيق يعمل بـ localStorage تلقائياً

export const isSupabaseEnabled =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// للتفعيل:
// 1) أنشئ مشروع على https://supabase.com
// 2) نفّذ ملف supabase/schema.sql في محرر SQL
// 3) أضف المفاتيح في .env.local
