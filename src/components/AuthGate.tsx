"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Splash from "./Splash";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }

    const timeout = setTimeout(() => setLoading(false), 3000);

    sb.auth.getSession()
      .then(({ data, error }) => {
        clearTimeout(timeout);
        if (error) console.warn("Auth error:", error.message);
        setAuthed(!!data.session);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeout);
        setLoading(false);
      });

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => { clearTimeout(timeout); sub.subscription.unsubscribe(); };
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">جاري التحميل...</div>;
  if (!authed) return <Splash />;
  return <>{children}</>;
}
