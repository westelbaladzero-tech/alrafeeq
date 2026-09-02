"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { KEYS } from "@/lib/keys";

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
        // بعض روابط Supabase ترجع access_token/refresh_token داخل hash
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) { router.replace("/auth/login"); return; }

          // نظّف الرابط بعد تثبيت الجلسة
          window.history.replaceState({}, document.title, "/auth/callback");
        }

        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session) { router.replace("/auth/login"); return; }

        const { data } = await sb.auth.getUser();
        if (!data.user) { router.replace("/auth/login"); return; }
        user = data.user;
      }

      // خزّن user_id محليًا فورًا — قبل أي فحص لـ profile
      if (typeof window !== "undefined") {
        localStorage.setItem(KEYS.userId, user.id);
      }

      const { data: profile } = await sb
        .from("profiles").select("id, client_id").eq("id", user.id).maybeSingle() as any;

      if (profile) {
        // خزّن client_id و user_id محليًا
        if (typeof window !== "undefined") {
          if (profile.client_id) {
            localStorage.setItem(KEYS.clientId, profile.client_id);
          }
        }
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
