"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = params.get("code");
    const sb = getSupabase();
    if (!sb || !code) { router.replace("/auth/login"); return; }

    sb.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.user) { router.replace("/auth/login"); return; }

      // تحقق: هل الملف الشخصي موجود؟
      const { data: profile } = await sb
        .from("profiles").select("id").eq("id", data.user.id).maybeSingle();

      if (profile) {
        // عنده حساب كامل → للتطبيق
        router.replace("/");
      } else {
        // جديد → أكمل البيانات
        router.replace("/auth/complete-profile");
      }
    });
  }, [params, router]);

  return <div className="flex items-center justify-center h-screen text-gray-400">جاري التأكيد...</div>;
}

export default function CallbackPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>}>
    <CallbackInner />
  </Suspense>;
}
