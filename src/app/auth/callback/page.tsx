"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function finishAuth() {
      const code = params.get("code");
      const sb = getSupabase();
      if (!sb) { router.replace("/auth/login"); return; }

      let user = null as Awaited<ReturnType<typeof sb.auth.getUser>>["data"]["user"];

      if (code) {
        const { data, error } = await sb.auth.exchangeCodeForSession(code);
        if (error || !data.user) { router.replace("/auth/login"); return; }
        user = data.user;
      } else {
        // بعض روابط Supabase ترجع الجلسة في hash (#access_token) بدل ?code
        await new Promise(r => setTimeout(r, 700));
        const { data } = await sb.auth.getUser();
        if (!data.user) { router.replace("/auth/login"); return; }
        user = data.user;
      }

      // تحقق: هل الملف الشخصي موجود؟
      const { data: profile } = await sb
        .from("profiles").select("id").eq("id", user.id).maybeSingle();

      if (profile) {
        router.replace("/");
      } else {
        router.replace("/auth/complete-profile");
      }
    }

    finishAuth();
  }, [params, router]);

  return <div className="flex items-center justify-center h-screen text-gray-400">جاري التأكيد...</div>;
}

export default function CallbackPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">جاري التحميل...</div>}>
    <CallbackInner />
  </Suspense>;
}
