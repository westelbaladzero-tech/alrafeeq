"use client";
import { useEffect, useState } from "react";
import { Shield, Users, Receipt, Mic, Trash2, LogOut, Loader2, Eye, EyeOff, Activity, Mail, Database, Zap, RefreshCw } from "lucide-react";
import MicLabView from "@/components/MicLabView";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [stats, setStats] = useState({ users: 0, transactions: 0, messages: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [section, setSection] = useState<"stats" | "users" | "tools" | "services">("stats");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [services, setServices] = useState<any>(null);
  const [testingServices, setTestingServices] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then(r => r.ok ? setAuthed(true) : setAuthed(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  async function loadData() {
    const [statsRes, usersRes] = await Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }),
      fetch("/api/admin/users", { credentials: "include" }),
    ]);
    const statsData = await statsRes.json();
    const usersData = await usersRes.json();
    if (statsData.ok) setStats({ users: statsData.users, transactions: statsData.transactions, messages: statsData.messages });
    if (usersData.ok) setUsers(usersData.users || []);
    loadServices();
  }

  async function loadServices() {
    setTestingServices(true);
    try {
      const res = await fetch("/api/admin/health", { credentials: "include" });
      const data = await res.json();
      if (data.ok) setServices(data.services);
    } finally {
      setTestingServices(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "فشل الدخول"); return; }
      setAuthed(true);
    } catch {
      setLoginError("خطأ في الاتصال");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setEmail("");
    setPassword("");
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`حذف ${name} وكل بياناته؟ هذا لا يمكن التراجع عنه.`)) return;
    setDeletingId(userId);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setStats(prev => ({ ...prev, users: prev.users - 1 }));
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (checking) {
    return <div className="flex items-center justify-center h-screen bg-gray-50">
      <Loader2 className="animate-spin text-violet-600" size={24} />
    </div>;
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center">
              <Shield className="text-white" size={28} />
            </div>
            <h1 className="text-lg font-bold text-gray-800">لوحة تحكم الرفيق</h1>
            <p className="text-xs text-gray-400">دخول الأدمن فقط</p>
          </div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="الإيميل" required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500" />
          <div className="relative">
            <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="الباسورد" required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500" />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
          <button type="submit" disabled={loggingIn}
            className="w-full rounded-xl bg-violet-600 text-white py-3 font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loggingIn ? <Loader2 size={18} className="animate-spin" /> : "دخول"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* الهيدر */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Shield className="text-white" size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-800 text-sm">لوحة تحكم الرفيق</div>
              <div className="text-[10px] text-gray-400">{stats.users} مستخدم · {stats.transactions} معاملة</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-gray-400 hover:text-red-500 text-sm">
            <LogOut size={16} /> خروج
          </button>
        </div>
        {/* التبويبات */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1">
          {[
            { key: "stats" as const, label: "إحصائيات", icon: <Shield size={16} /> },
            { key: "users" as const, label: "المستخدمين", icon: <Users size={16} /> },
            { key: "services" as const, label: "خدمات", icon: <Activity size={16} /> },
            { key: "tools" as const, label: "أدوات", icon: <Mic size={16} /> },
          ].map(t => (
            <button key={t.key} onClick={() => setSection(t.key)}
              className={"flex items-center gap-1 px-4 py-2 text-sm border-b-2 transition " +
                (section === t.key ? "border-violet-600 text-violet-600 font-bold" : "border-transparent text-gray-400")}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {section === "stats" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-violet-600 mb-2">
                <Users size={18} /><span className="text-sm">المستخدمين</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.users}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <Receipt size={18} /><span className="text-sm">المعاملات</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.transactions}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Mic size={18} /><span className="text-sm">الرسائل</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.messages}</div>
            </div>
          </div>
        )}

        {section === "users" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
              إدارة الحسابات ({users.length})
            </div>
            <div className="divide-y divide-gray-50">
              {users.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">لا يوجد مستخدمون</div>
              ) : users.map(u => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-800 text-sm">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email} · {u.tx_count} معاملة</div>
                    {u.work_type && <div className="text-[10px] text-gray-300">{u.work_type}</div>}
                  </div>
                  <button onClick={() => deleteUser(u.id, u.name)} disabled={deletingId === u.id}
                    className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center disabled:opacity-50">
                    {deletingId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "services" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700 text-sm">حالة الخدمات</h3>
              <button onClick={loadServices} disabled={testingServices}
                className="flex items-center gap-1 text-violet-600 text-sm disabled:opacity-50">
                {testingServices ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                فحص
              </button>
            </div>

            {services ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "gemini", label: "Gemini AI", icon: <Zap size={18} />, color: "blue" },
                  { key: "groq", label: "Groq AI", icon: <Zap size={18} />, color: "green" },
                  { key: "smtp", label: "البريد (SMTP)", icon: <Mail size={18} />, color: "orange" },
                  { key: "supabase", label: "Supabase DB", icon: <Database size={18} />, color: "violet" },
                ].map(svc => {
                  const s = services[svc.key];
                  if (!s) return null;
                  const pct = svc.key !== "supabase" && s.limit ? Math.min(100, (s.today / s.limit) * 100) : 0;
                  return (
                    <div key={svc.key} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={"text-" + svc.color + "-600"}>{svc.icon}</span>
                          <span className="font-bold text-gray-700 text-sm">{svc.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={"w-2.5 h-2.5 rounded-full " + (s.ok ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                          <span className={"text-xs font-bold " + (s.ok ? "text-green-600" : "text-red-500")}>
                            {s.ok ? "متصل" : "مقطوع"}
                          </span>
                        </div>
                      </div>

                      {s.latency > 0 && (
                        <div className="text-[10px] text-gray-400 mb-1">زمن الاستجابة: {s.latency}ms</div>
                      )}
                      {s.error && (
                        <div className="text-[10px] text-red-400 mb-1">{s.error}</div>
                      )}

                      {svc.key !== "supabase" && s.limit > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                            <span>اليوم: {s.today} / {s.limit}</span>
                            <span>الشهر: {s.month}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={"h-full rounded-full " + (pct > 80 ? "bg-red-500" : pct > 50 ? "bg-orange-400" : "bg-green-500")}
                              style={{ width: pct + "%" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : testingServices ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8 text-sm">اضغط "فحص" لفحص الخدمات</div>
            )}
          </div>
        )}

        {section === "tools" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
              أدوات الاختبار
            </div>
            <div className="p-4">
              <MicLabView />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
