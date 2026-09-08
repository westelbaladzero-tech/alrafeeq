"use client";
import { useEffect, useState, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import { getUserIdSync } from "@/lib/client-id";
import { KEYS } from "@/lib/keys";
import Splash from "./Splash";

const IDLE_LIMIT = 10 * 60 * 1000; // 10 دقائق خمول → خروج تلقائي
const CHECK_INTERVAL = 30 * 1000; // فحص كل 30 ثانية

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const lastActivity = useRef<number>(Date.now());

  // ─── تتبّع نشاط المستخدم ───
  useEffect(() => {
    function updateActivity() {
      lastActivity.current = Date.now();
    }
    // أي تفاعل يُحدّث آخر نشاط
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    // ─── فحص دوري للخمول ───
    const idleChecker = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle > IDLE_LIMIT && authed) {
        // خروج تلقائي
        const sb = getSupabase();
        if (sb) sb.auth.signOut();
        if (typeof window !== "undefined") {
          localStorage.removeItem(KEYS.userId);
          localStorage.removeItem(KEYS.clientId);
        }
        setAuthed(false);
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(idleChecker);
    };
  }, [authed]);

  useEffect(() => {
    // لو فيه userId محفوظ محلياً، اعتبر المستخدم مسجلاً حتى لو الجلسة منتهية
    const localUid = getUserIdSync();
    if (localUid) {
      setAuthed(true);
      lastActivity.current = Date.now();
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
          lastActivity.current = Date.now();
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
        lastActivity.current = Date.now();
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
