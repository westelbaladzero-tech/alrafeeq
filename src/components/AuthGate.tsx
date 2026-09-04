"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getUserIdSync } from "@/lib/client-id";
import Splash from "./Splash";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // لو فيه userId محفوظ محلياً، اعتبر المستخدم مسجلاً حتى لو الجلسة منتهية
    const localUid = getUserIdSync();
    if (localUid) {
      setAuthed(true);
    }

    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }

    const timeout = setTimeout(() => setLoading(false), 3000);

    sb.auth.getSession()
      .then(({ data, error }) => {
        clearTimeout(timeout);
        if (error) console.warn("Auth error:", error.message);
        // لو فيه جلسة صالحة OR userId محفوظ محلياً ← مسجّل
        if (data.session || getUserIdSync()) {
          setAuthed(true);
        } else {
          setAuthed(false);
        }
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeout);
        // عند الخطأ، ابقَ مسجلاً لو فيه userId محفوظ
        setAuthed(!!getUserIdSync());
        setLoading(false);
      });

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session || getUserIdSync()) {
        setAuthed(true);
      } else {
        setAuthed(false);
      }
    });
    return () => { clearTimeout(timeout); sub.subscription.unsubscribe(); };
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">جاري التحميل...</div>;
  if (!authed) return <Splash />;
  return <>{children}</>;
}
