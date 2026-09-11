# خريطة تطبيق "الرفيق الأمين" — التوثيق الأمني والمعماري

> المبدأ: "الإصلاح بدون فهم البنية يمكن أن يكون إفسادًا" — هذه الخريطة تمنع أي إصلاح مستقبلي من أن يكسر ترابط التطبيق.

---

## نظرة عامة

الرفيق الأمين — مساعد مالي شخصي بُني بـ Next.js 16 (Turbopack) + Supabase + Vercel.

- المستخدم: عبدالله (مطور النظام)
- المنطقة: Supabase eu-west-1 (برنامج Alrafeek، ref: nfcfzfzqzifrzeamujyf)
- الـ stack: Next.js + Supabase (Postgres + Auth) + Gemini AI
- آخر تحديث: 11 سبتمبر 2026

---

## خريطة المسارات (API Routes) — 31 مسارًا

كل مسار يتطلب مصادقة + rate limiting (إلا ما ذُكر عكس ذلك).

### /api/auth/* (6 مسارات) — الهوية والتسجيل
- auth/register — تسجيل جديد + إرسال رابط تأكيد الإيميل (strict=true: IP + email)
- auth/complete-profile — ربط الهاتف + PIN بعد تأكيد الإيميل (يولّد profileClientId)
- auth/login — تسجيل دخول بالهاتف + PIN (strict=true: IP + phone، رسالة خطأ موحّدة)
- auth/recover — استعادة الحساب (strict=true)
- auth/reset-pin — إعادة تعيين PIN (strict=true)
- verify-pin — التحقق من PIN للجلسة

### /api/admin/* (7 مسارات) — لوحة الأدمن
- admin/login — دخول الأدمن (strict=true: 3 طبقات IP + email + lock تراكمي 30د)
- admin/logout — خروج (حذف cookie) [لا CSRF — خطر ضعيف]
- admin/delete-user — حذف مستخدم كامل (تحقق UUID regex + CASCADE FK على messages)
- admin/health — فحص صحة النظام
- admin/stats — إحصائيات
- admin/usage — استهلاك Gemini (crypto.timingSafeEqual؛ geminiLimit hardcoded)
- admin/users — قائمة المستخدمين

### /api/chat (1 مسار) — المحادثة مع الـ AI
- chat — محادثة Gemini AI — حارس مصادقة إلزامي: if(!userId) return 401

### /api/p2p/* (6 مسارات) — التحويلات بين الأشخاص
- p2p — قائمة (GET) + إلغاء (POST)
- p2p/initiate — بدء تحويل
- p2p/confirm — تأكيد + إنشاء رسالة sanad في messages
- p2p/dispute — فتح نزاع
- p2p/dispute/resolve — حل النزاع
- p2p/upload-receipt — رفع إيصال

### /api/* المالية (5 مسارات)
- sanad — سندات دفع (GET + POST)
- settlement — تسويات
- payment-methods — وسائل دفع (GET/POST/DELETE)
- relationship-change — طلبات تغيير العلاقة (GET/POST/PATCH)
- friends/add — إضافة صداقة

### /api/* الذكاء الاصطناعي والملفات (5 مسارات)
- mic-test — اختبار الميكروفون (Gemini)
- image-text — استخراج نص من صورة (Gemini)
- receipt-test — قراءة فاتورة (Gemini)
- tts — تحويل نص لصوت
- upload — رفع ملفات

### مسار الصيانة
- cleanup-rate-limits — تنظيف عدّادات rate limit القديمة

---

## خريطة lib (19 ملفًا)

### طبقة البيانات والمزامنة
- store.ts — طبقة التخزين: محلي أولًا + سحابة كنسخة احتياطية (يستهلك supabase.ts, sync.ts, keys.ts, client-id.ts)
- supabase.ts — عميل Supabase للعميل (client-side)
- supabase-server.ts — getAdminClient (service_role) + getServerClient — يستخدمه كل مسار API
- sync.ts — كشف الاتصال + طابور المزامنة دون اتصال (يستهلكه store.ts)
- keys.ts — مفاتيح تخزين محلية موحّدة (يستهلكه store.ts)
- client-id.ts — getResolvedUserId — معرّف المستخدم للمزامنة (يستهلكه store.ts)

### الأمان والمصادقة
- auth-server.ts — getAuthUserId(req) — يستخدمه كل مسار محمي (27 مسارًا)
- auth-client.ts — مصادقة العميل
- rate-limit.ts — rateLimitDB + دعم strict mode (fail-closed/fail-open)
- validation.ts — validatePin وغيرها
- sanitize.ts — تنظيف المدخلات
- validate-upload.ts — التحقق من الملفات المرفوعة
- e2e-crypto.ts + e2e-key-manager.ts — تشفير طرف-لطرف (E2E)

### المساعد والأدوات
- parser.ts — تحليل نية رسالة المستخدم
- learned-responses.ts — ردود متعلّمة
- audit-log.ts — سجل التدقيق
- usage.ts — trackUsage — تتبع استهلاك Gemini
- types.ts — أنواع TypeScript المشتركة (مثل Transaction)

---

## قاعدة البيانات — الجداول الرئيسية والترابط

auth.users (Supabase Auth)
  +-- profiles (id = auth.users.id، phone، pin_hash، client_id)
  +-- transactions (user_id) <-- store.ts يكتب هنا
  +-- friendships (user_a، user_b) <-- friends/add
  |     +-- messages (friendship_id --> CASCADE، sender_id)
  |            ^ p2p/confirm يكتب رسائل sanad هنا
  +-- p2p_transactions (from_user، to_user)
  +-- sanad_records (from_user، to_user)
  +-- settlements (from_user، to_user)
  +-- debt_requests (creditor، debtor)
  +-- gam3eya_turns (user_id)
  +-- payment_methods (user_id)
  +-- relationship_change_requests (requester_id)
  +-- chat_messages (user_id --> CASCADE)

### دوال Postgres محمية بـ REVOKE (من anon/authenticated/PUBLIC)
- check_and_increment_rate_limit(text، integer، integer) — أُصلحت في هذه الجلسة
- cleanup_old_rate_limits()
- check_debt_completion()
- handle_gam3eya_turn_on_settlement()
- handle_installment_on_settlement()
- handle_sanad_on_p2p() / handle_sanad_on_settlement()
- handle_simple_debt_on_settlement()
- update_p2p_timestamp()
- get_friend_profile(uuid)

---

## الإصلاحات الأمنية (هذه الجلسة — 5 commits)

> كل إصلاح مُلتزم على GitHub ودُفع لـ Vercel. الترتيب من الأقدم للأحدث.

### 1. commit 22749e7 — إزالة استيراد مكرر (TypeScript build)
المشكلة: mic-test/route.ts و image-text/route.ts كان فيهما import { getAuthUserId } مرتين — يفشل بناء TS.
الإصلاح: حذف السطر المكرر من كلا الملفين.
الترابط: getAuthUserId من lib/auth-server.ts — أساسي لكل مسار محمي.

### 2. commit f974a0b — ثغرة REVOKE الناقصة (DB security)
المشكلة: دالة check_and_increment_rate_limit كانت مكشوفة لـ anon/authenticated/PUBLIC على الـ production (مكشوفة DoS). cleanup_old_rate_limits مقفولة، لكن الأساسية نُسيت.
الإصلاح: REVOKE EXECUTE ON FUNCTION ... FROM anon، authenticated، PUBLIC على الـ production DB + توثيق في supabase/fix_financial_function_grants.sql.
الترابط: الدالة تُستدعى من lib/rate-limit.ts بـ admin.rpc() (service_role فقط). التطبيق ما تأثر.

### 3. commit fc0b398 — تعارض clientId في complete-profile (build)
المشكلة: const clientId معرّف مرتين في نفس الـ scope (rate limiting + profile client_id) — TS2451 يفشل بناء Vercel.
الإصلاح: إعادة تسمية الثاني إلى profileClientId.
الترابط: getClientId (من rate-limit.ts) للـ rate limiting؛ crypto.randomUUID() للملف الشخصي. اسمان مختلفان لمعنيين مختلفين.

### 4. commit 526b311 — تحصين شامل (strict rate limiting + auth guards)
المشكلة: rate limiting كان fail-open دائمًا — لو فشل، يسمح بالطلب (خطر للمسارات الحساسة). كذلك chat ما كان يتحقق إلزاميًا من userId، و admin/delete-user ما كان يتحقق من UUID قبل .or().
الإصلاح:
- lib/rate-limit.ts: أضاف بارامتر strict (fail-closed للمسارات الحساسة)
- طبّق strict=true على: admin/login، auth/login، auth/register، auth/reset-pin
- chat/route.ts: if(!userId) return 401 (حارس مصادقة إلزامي)
- admin/delete-user: تحقق UUID regex قبل .or() (منع SQL injection)

### 5. commit 97df803 — إصلاحات store.ts الثلاثة (طبقة البيانات)
المشكلة (1) — IDOR حرج: deleteTransaction كان يحذف بـ .eq('id'، id) فقط — أي مستخدم يحذف معاملة أي مستخدم آخر لو عنده الـ id.
الإصلاح (1): أضاف .eq('user_id'، uid).

المشكلة (2) — person ضائع: addTransaction insert ما كان يمرّر person، لكن rowToTx يقرؤه — البيانات تضيع عند المزامنة.
الإصلاح (2): أضاف person: tx.person للـ insert.

المشكلة (3) — @ts-nocheck: أول سطر كان // @ts-nocheck يعطّل فحص TS كاملًا للملف — يخفي أي أخطاء.
الإصلاح (3): رفع @ts-nocheck. تحقق بـ tsc --noEmit: 0 أخطاء جديدة (الكود كان نظيفًا).

---

## المراجعات المكتملة (كلها منجزة)

| الملف | النتيجة | الإجراء |
|--------|---------|---------|
| lib/store.ts | 3 مشاكل حرجة | مُصلحة (97df803) |
| admin/usage | ممتاز (timingSafeEqual) | geminiLimit يُفضّل من env |
| admin/logout | بسيط وصح | CSRF (خطر ضعيف) |
| admin/delete-user (messages) | ليست مشكلة فعلية | CASCADE FK يحلها تلقائيًا |
| كل مسارات API (31) | 0 تعارضات متغيرات | متحقق بـ tsc --noEmit |

---

## التنبيهات الأمنية المعلّقة (على المستخدم)

1. Supabase Access Token sbp_3d84cc... تسرّب — لازم يُدوّر فورًا (Supabase → Account → Access Tokens)
2. GitHub PAT مكشوف في git remote URL — لازم يُدوّر ويُستبدل بـ SSH

---

## مقترحات مستقبلية (غير عاجلة)

- اختبارات حية للتريغرات — تتبع ترتيب تنفيذها وسلوكها عند التعارض/الفشل
- Pentest احترافي مستقل — تحقق خارجي شامل
- ربط transactions.person تلقائيًا بـ friendships — قرار بنيوي لاحق
- geminiLimit من env بدل hardcoded في admin/usage
- CSRF protection على admin/logout (خطر ضعيف)
- مراجعة RLS policies على الجداول (الخطوة المنطقية التالية)

---

## كيفية استخدام هذه الخريطة

قبل أي إصلاح مستقبلي:
1. حدّد الدومين (auth / admin / p2p / مالية / AI)
2. راجع الترابط في قسم lib والـ DB
3. تحقق إن الإصلاح ما يكسر دوال REVOKE أو CASCADE FK
4. شغّل tsc --noEmit للتأكد من عدم إدخال تعارضات
5. التزم برسالة واضحة تشرح المشكلة + الإصلاح + الترابط

> التطبيق في حالة صحية ومحمية بعد هذه الجلسة. كل الثغرات المكتشفة مُصلحة ومُلتزمة ومُدفوعة. الحمد لله رب العالمين.

---

## اختبار الثغرات المنطقية في Workflows (هذه الجلسة)

> اختبار منطقي للـ workflows المالية لكتشف ثغرات الـ edge cases اللي ما تظهر في مراجعة الكود.

### P2P Workflow (commit f4ee740)

**1. Race condition في confirm — تكرار تسوية الدين 🔴🔴**
- المشكلة: side effects (sanad + settle_debt + create_sanad) قبل update الحالة. طلبان متزامنان يضاعفان التسوية.
- الإصلاح: atomic lock قبل side effects (`update WHERE status=verifying` → 409 لو فشل)

**2. Dispute self-resolve — تلاعب بالـ ledger 🔴🔴**
- المشكلة: أي طرف يقدر يفتح نزاع ثم يحله بـ `accept` (refunded) → يدّعي استرجاع ما صار
- الإصلاح: عمود `dispute_opened_by` + تحقق في resolve إن `userId ≠ dispute_opened_by`

### sanad + settlement Workflow (commit 08e14ec)

**3. status من العميل — تلاعب بالـ ledger 🔴🔴**
- المشكلة: `sanad` ينشئ `status: status || "confirmed"` ذاتياً؛ `settlement` ينشئ `status: status || "pending"` (يقدر يمرر `settled`)
- الإصلاح: `status: "pending"` فقط (تجاهل من العميل) + `confirmed_at: null`

**4. to_user غير محقّق 🔴🔴**
- المشكلة: المستخدم يمرر `to_user` بدون تحقق من إنه الطرف الآخر في الصداقة
- الإصلاح: `const otherParty = ship.user_a === userId ? ship.user_b : ship.user_a; if (to_user !== otherParty) return 400`

**5. amount بدون validateAmount في sanad 🔴**
- المشكلة: `Number(amount)` يقبل سالب/صفر (يكسر الـ ledger)
- الإصلاح: استخدم `validateAmount` (consistency مع settlement)

### relationship-change PATCH (commit 08e14ec)

**6. update بدون تحقق من status='pending' 🔴**
- المشكلة: الـ update ما فيه `.eq("status", "pending")` → يعكس الموافقة/الرفض على طلب already-resolved، والتغيير المطبق على الصداقة ما ينعكس
- الإصلاح: أضف `.eq("status", "pending")` + 409 لو already-resolved + تطبيق التغيير فقط لو الـ update نجح

### Workflows سليمة (لا ثغرات مكتشفة)
- `friends/add` — رد موحّد ضد enumeration، منع self-friend، تأخير ثابت ضد timing attacks
- `register` — magic link + strict rate limiting (طبقتان)
- `payment-methods` GET — يتحقق من الصداقة قبل عرض وسائل الصديق
- `relationship-change` self-approve — محمي (`requester_id === userId` → 403)

### الأنماط المتكررة المكتشفة
الثغرات الـ 6 تنحصر في 3 أنماط (قابلة للإصلاح الدفعي):
1. **status من العميل (mass assignment)** — تجاهل status، status الافتراضي "pending"
2. **to_user غير محقّق** — تحقق `to_user = الطرف الآخر في الصداقة`
3. **عدم تحقق من status الحالي في الـ update** — أضف `.eq("status", "pending")`

---

## اختبار الثغرات المنطقية في Auth Workflow (هذه الجلسة)

### auth/login — PIN brute force race condition 🔴🔴 (commit a32e815)

**المشكلة:** عدّاد المحاولات الفاشلة ما كان محميًا بـ optimistic lock.
- المهاجم يرسل 10 طلبات متزامنة بـ PIN خاطئ
- كل طلب يقرأ `failed_attempts = 0` (نفس القيمة)
- كل طلب يحدّث `failed_attempts = 1` (مو 10!)
- **القفل التراكمي (MAX_ATTEMPTS=5) ما يتفعل → PIN brute بآلاف المحاولات!**

**الإصلاح:** optimistic lock في الـ update:
```typescript
await admin.from("profiles")
  .update(updates)
  .eq("phone", phone)
  .eq("failed_attempts", currentAttempts);  // ← الحامي
```
لو طلب آخر سبق وحدّث العدّاد، الـ update يفشل (0 صفوف) → الرد الموحّد يخفي الحالة.

### verify-pin — strict rate limiting 🔴 (commit a32e815)

**المشكلة:** `verify-pin` استخدم `rateLimitDB(..., 5, 60)` بدون `strict=true` (fail-open). `auth/login` استخدم `strict=true` (fail-closed). عدم اتساق — `verify-pin` مسار حساس ويقبل الطلبات عند فشل rate limiting.

**الإصلاح:** أضف `true` للطبقتين (IP + user) — consistency مع `auth/login`.

### payment-methods POST/DELETE — سليم ✅
- POST: validation كامل لكل نوع (wallet regex، instapay @، card_type/last_four، bank_name)
- منع `card_full` (لا يقبل الرقم الكامل)
- `sanitizeText` لكل الحقول + `user_id: userId`
- DELETE: IDOR محمي `.eq("id", id).eq("user_id", userId)`

---

## اختبار الثغرات في AI/Chat Routes (هذه الجلسة)

### chat/route.ts — validation ناقصة 🟡 (commit 92475af)

**المشكلة (1):** `message` بلا حد للطول — المهاجم يمرر رسالة ميجابايت → استهلاك Gemini quota + تكلفة.
**الإصلاح:** `if (message.length > 2000) return 400`

**المشكلة (2):** `history` من العميل بلا validation — prompt injection محتمل + استهلاك.
**الإصلاح:** `if (history && (!Array.isArray(history) || history.length > 20)) return 400`

### tts/route.ts — لا rate limiting 🔴 (commit 92475af)

**المشكلة:** tts ما فيه rate limiting نهائياً — المهاجم يرسل آلاف الطلبات → استهلاك Google TTS quota + تكلفة عالية.
**الإصلاح:** `rateLimitDB("tts:" + clientId, 10, 60)`

**المشكلة (إضافية):** `rate` من العميل بلا clamp — ممكن 100 أو سالب.
**الإصلاح:** `const safeRate = Math.max(0.25, Math.min(4.0, Number(rate) || 1.0))`

### ملخص نوعية الثغرات في AI routes
هذه الثغرات **بسيطة** مقارنة بالـ workflows المالية:
- ❌ لا race conditions
- ❌ لا mass assignment
- ❌ لا IDOR
- ❌ لا logic bypass
- ✅ بس استهلاك quota + تكلفة + prompt injection محتمل

---

## اختبار الثغرات في File Upload Routes (هذه الجلسة)

### mic-test/route.ts — mimeType + size validation 🟡 (commit 5086abd)

**المشكلة:** لا حد لحجم الملف + لا validation على mimeType → استهلاك Gemini quota بملفات ضخمة + ملفات غير صوتية.
**الإصلاح:**
```typescript
if (!mimeType.startsWith("audio/")) return 400;
if (bytes > 5 * 1024 * 1024) return 400;
```

### image-text/route.ts — size validation 🟡 (commit 5086abd)

**المشكلة:** لا حد لحجم الصورة (mimeType محقّق سابقاً) → استهلاك quota بصور ضخمة.
**الإصلاح:** `if (image.size > 5 * 1024 * 1024) return 400`

### upload/route.ts — folder + expiry validation 🟡 (commit 5086abd)

**المشكلة:** `folder` من العميل بلا validation (path traversal محتمل) + `expiry` بلا clamp (قيم متطرفة).
**ممتاز سابقاً:** `MAX_FILE_SIZE = 4MB` + magic bytes check + ALLOWED types whitelist ✓
**الإصلاح:**
```typescript
const folder = /^[a-zA-Z0-9_-]+$/.test(folderRaw) ? folderRaw : "chat";
const expiry = Math.max(60, Math.min(86400, expiryRaw));
```

### ملخص نوعية الثغرات في File Upload routes
نفس نمط AI routes — ثغرات بسيطة:
- ❌ لا race conditions / mass assignment / IDOR / logic bypass
- ✅ بس استهلاك quota + path traversal محتمل

---

## مراجعة ما بعد الإصلاح — اكتشاف وتصحيح التناقض الوظيفي

### الاكتشاف 🔴 (commit b14362e)

بعد المراجعة المركزة لـ sanad/settlement lifecycle، اكتُشف إن إصلاح `status="pending"` (commit 08e14ec) **كسر الـ workflow**:

- `chat/route.ts` يحسب الرصيد اعتمادًا على `settlements.status = "confirmed"` (السطور 374, 376)
- لكن `settlement/route.ts` صار ينشأ `status = "pending"` → التسويات الجديدة لا تظهر في حسابات الـ AI
- لا يوجد workflow تأكيد ثنائي في التطبيق (لا مسار confirm/resolve للتسويات)
- الـ design الأصلي: السند/التسوية موثّقة عند الإنشاء من المنشئ المصادق عليه

### التصحيح ✅ (commit b14362e)

الإصلاح الصحيح ليس `status="pending"` (يكسر الـ workflow)، بل **`status` ثابت `confirmed` يتجاهل العميل**:
```typescript
// sanad/route.ts
status: "confirmed",  // ثابت — تجاهل من العميل
confirmed_at: new Date().toISOString(),

// settlement/route.ts
status: "confirmed",  // ثابت — تجاهل من العميل
```

هذا:
- ✅ يمنع التلاعب (status ثابت، لا يقبل من العميل) — الثغرة الأصلية محمية
- ✅ يرجع للسلوك الأصلي (sanad/settlement confirmed عند الإنشاء)
- ✅ chat يراها confirmed → الحسابات تشتغل

### التحقق من الـ DB ✅

استعلام Supabase: `0` سجلات pending متبقية في `sanad_records` و `settlements` — ما في سندات/تسويات أنشأت بـ status="pending" في فترة الاختبار القصيرة. الـ DB نظيف.

### الدرس المهندسي 🎯

> **الإصلاح الأمني المحلي الصحيح قد يكسر الـ workflow العام إذا لم تُفهم الصورة الكاملة.**

إصلاح `status="pending"` كان أمنيًا صحيح (منع التلاعب)، لكنه كسر المنطق لأن التطبيق يعتمد على `confirmed` عند الإنشاء. الحل: `status` ثابت يتجاهل العميل — يحقق الأمان دون كسر الـ workflow.

**هذا يثبت أهمية مبدأ عبدالله: "الإصلاح بدون فهم البنية يمكن أن يكون إفسادًا".**
