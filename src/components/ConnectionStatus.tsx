"use client";
import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { isOnline, onConnectionChange, syncAll, getPendingCount } from "@/lib/sync";
import { getSupabase } from "@/lib/supabase";

export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(isOnline());
    const unsub = onConnectionChange((on, p) => {
      setOnline(on);
      setPending(p);
    });

    // حدّث عدد المعلق عند التحميل
    (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      if (data.user?.id) {
        setPending(getPendingCount(data.user.id));
      }
    })();

    return unsub;
  }, []);

  async function handleSync() {
    setSyncing(true);
    const result = await syncAll();
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.auth.getUser();
      if (data.user?.id) setPending(getPendingCount(data.user.id));
    }
    setSyncing(false);
  }

  // لو متصل ولا يوجد معلق → لا تظهر شيئًا
  if (online && pending === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-1 text-[10px]">
      {online ? (
        <span className="flex items-center gap-1 text-blue-500">
          <Wifi size={11} /> متصل
          {pending > 0 && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1 text-orange-500 hover:text-orange-600">
              · {pending} معلّق
              {syncing ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            </button>
          )}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-gray-400">
          <WifiOff size={11} /> غير متصل — البيانات محفوظة محليًا
        </span>
      )}
    </div>
  );
}
