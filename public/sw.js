// Service Worker — الرفيق الأمين
// يخزن واجهة التطبيق لتعمل أوفلاين

const CACHE_NAME = "alrafeeq-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

// ─── التثبيت: خزن الواجهة الأساسية ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── التنشيط: امسح النسخ القديمة ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── الطلبات: استراتيجية ذكية ───
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // API routes → شبكة فقط (لا تخزن أبداً)
  if (path.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets → cache-first (سريع)
  if (path.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
      )
    );
    return;
  }

  // الصفحات → network-first (الأحدث، fallback للكاش)
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("/")))
  );
});
