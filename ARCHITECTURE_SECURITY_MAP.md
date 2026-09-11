# خريطة الرفيق — المسارات والاتجاهات والقرارات الأمنية

آخر تحديث: 2026-09-11

## الهدف
هذا الملف مرجع ثابت يشرح:
- مسارات التطبيق المالية الأساسية
- نقاط الانتقال الحساسة في الحالة
- أين تتم التحديثات النهائية
- ما الذي يجب أن يبقى داخل قاعدة البيانات / التريغرات
- ما الذي لا يجوز الاعتماد فيه على العميل

---

# 1) المبادئ الثابتة

## 1.1 لا نعتمد على العميل في المنطق المالي النهائي
أي شيء من التالي يجب أن يكون في قاعدة البيانات أو Route موثّق أو Trigger:
- إنشاء سند
- إغلاق دين
- زيادة عداد أقساط
- تسجيل دور جمعية
- نقل حالة معاملة مالية
- منع التكرار أو التجاوز

## 1.2 أي دالة مالية داخلية يجب أن تكون مقفولة
القاعدة:
- `service_role` + `postgres` فقط
- لا `anon`
- لا `authenticated`
- لا `PUBLIC`

## 1.3 أي انتقال حالة مهم يجب أن يمر عبر Trigger أو سلسلة خادم موثوقة
القاعدة:
- لا نعتمد على `fetch` من العميل لإكمال الحلقة
- لا نعتمد على نص حر داخل `description`
- نعتمد على أعمدة صريحة (`category`, `linked_debt_id`, ...)

---

# 2) الكيانات الأساسية

## 2.1 debt_requests
يمثل الدين بين طرفين.

أهم الأعمدة:
- `id`
- `creditor`
- `debtor`
- `friendship_id`
- `amount`
- `status`
- `is_installment`
- `total_installments`
- `installment_amount`
- `paid_installments`
- `settled_amount`
- `confirmed_at`
- `completed_at`

### حالات status المسموحة
- `pending`
- `confirmed`
- `rejected`
- `settled`
- `completed`
- `p2p_pending`

## 2.2 settlements
يمثل تسوية مرتبطة بعلاقة مالية مباشرة.

أهم الأعمدة:
- `id`
- `from_user`
- `to_user`
- `friendship_id`
- `amount`
- `description`
- `status`
- `linked_debt_id`
- `category`

### حالات category المسموحة
- `debt`
- `installment`
- `gam3eya`

## 2.3 p2p_transactions
يمثل تحويل خارجي موثّق داخل التطبيق.

أهم الأعمدة:
- `id`
- `from_user`
- `to_user`
- `friendship_id`
- `amount`
- `method`
- `status`
- `debt_request_id`
- `receipt_url`
- `receipt_data`
- `expires_at`
- `sanad_message_id`
- `dispute_reason`
- `dispute_deadline`
- `dispute_resolution_note`

### حالات status المسموحة
- `initiated`
- `awaiting_details`
- `pending_payment`
- `receipt_uploaded`
- `verifying`
- `confirmed`
- `disputed`
- `settled`
- `cancelled`
- `refunded`
- `expired`

## 2.4 sanad_records
يمثل التوثيق النهائي للعمليات.

أهم الأعمدة:
- `id`
- `friendship_id`
- `type`
- `category`
- `from_user`
- `to_user`
- `amount`
- `description`
- `linked_debt_id`
- `linked_settlement_id`
- `linked_p2p_id`
- `payment_method`
- `receipt_url`
- `status`
- `sanad_number`
- `confirmed_at`

### قيود مهمة
- `UNIQUE(linked_settlement_id)` جزئيًا عند عدم null
- `UNIQUE(linked_p2p_id)` جزئيًا عند عدم null
- `UNIQUE(friendship_id, sanad_number)`

## 2.5 gam3eya_turns
يمثل أخذ الدور في الجمعية.

أهم الأعمدة:
- `id`
- `friendship_id`
- `user_id`
- `settlement_id`
- `taken_at`

### قيد مهم
- `UNIQUE(friendship_id, user_id)`

---

# 3) المسارات المالية الأساسية

## 3.1 الدين البسيط
### السلسلة
1. إنشاء دين في `debt_requests` مع:
   - `is_installment = false`
2. قبول الدين → `status = confirmed`
3. إنشاء تسوية مرتبطة به عبر `settlements.linked_debt_id`
4. عند تأكيد التسوية:
   - `simple_debt_settlement_trigger`
   - ينادي `settle_simple_debt`
   - يزيد `settled_amount` ذرّيًا
5. `debt_completion_trigger` يفحص:
   - إذا `settled_amount >= amount`
   - يحوّل الحالة إلى `settled`
   - يضبط `completed_at`
6. `sanad_settlement_trigger` ينشئ السند تلقائيًا

## 3.2 الأقساط
### السلسلة
1. إنشاء دين مع:
   - `is_installment = true`
   - `total_installments`
   - `installment_amount`
   - `paid_installments = 0`
2. قبول الدين → `status = confirmed`
3. إنشاء تسوية مرتبطة بالقسط عبر `linked_debt_id` و `category = installment`
4. عند تأكيد التسوية:
   - `installment_settlement_trigger`
   - ينادي `increment_paid_installments`
5. `debt_completion_trigger` يفحص:
   - إذا `paid_installments >= total_installments`
   - يحوّل الحالة إلى `completed`
   - يضبط `completed_at`
6. `sanad_settlement_trigger` ينشئ السند تلقائيًا

## 3.3 الجمعية
### السلسلة
1. الصداقة تكون جمعية عندما:
   - `friendships.relationship_type = association`
2. التسوية المرتبطة بالدور تستخدم:
   - `category = gam3eya`
3. عند تأكيد التسوية:
   - `gam3eya_turn_trigger`
   - ينادي `record_gam3eya_turn`
4. الإدراج في `gam3eya_turns` يمنع التكرار عبر `UNIQUE(friendship_id, user_id)`
5. يتم تحديث `friendships.gam3eya_completed` مشتقًا من عدد الأدوار
6. `sanad_settlement_trigger` ينشئ السند تلقائيًا

## 3.4 P2P مباشر
### السلسلة
1. `p2p/initiate`
   - ينشئ `p2p_transactions`
   - يضبط `expires_at`
2. `p2p/upload-receipt`
   - يتحقق من ownership
   - يتحقق من `expires_at`
   - يرفع الحالة إلى `verifying`
3. `p2p/confirm`
   - المستلم فقط يؤكد
   - يتحقق من `expires_at`
   - ينتقل إلى `settled`
4. `sanad_p2p_trigger`
   - ينشئ سندًا تلقائيًا في `sanad_records`
5. `p2p_update_timestamp`
   - يضبط `settled_at` / `cancelled_at`

## 3.5 P2P مربوط بدين
### السلسلة
1. عند البدء:
   - `suspend_debt_for_p2p`
   - يحوّل الدين إلى `p2p_pending`
2. عند اكتمال P2P:
   - `settle_debt_from_p2p`
   - ينشئ `settlement` مؤكدة مع:
     - `linked_debt_id`
     - `category = debt أو installment`
3. بعدها تشتغل التريغرات العادية على `settlements`:
   - سند
   - أقساط أو دين بسيط بحسب النوع

---

# 4) التريغرات الحالية

## على جدول settlements
- `gam3eya_turn_trigger`
- `installment_settlement_trigger`
- `sanad_settlement_trigger`
- `simple_debt_settlement_trigger`

كلها: `AFTER UPDATE`

## على جدول debt_requests
- `debt_completion_trigger`

## على جدول p2p_transactions
- `p2p_update_timestamp` (`BEFORE UPDATE`)
- `sanad_p2p_trigger` (`AFTER UPDATE`)

---

# 5) الدوال الداخلية المقفولة

يجب أن تبقى مقفولة على `service_role` + `postgres` فقط:
- `record_gam3eya_turn`
- `increment_paid_installments`
- `settle_simple_debt`
- `create_sanad_for_settlement`
- `create_sanad_for_p2p`
- `settle_debt_from_p2p`
- `suspend_debt_for_p2p`
- كل دوال `handle_*` الخاصة بالتريغرات

## ملاحظة
الدالة الوحيدة التي تبقى مفتوحة عمدًا:
- `check_and_increment_rate_limit`

لأنها جزء من بنية rate limiting نفسها.

---

# 6) المخاطر البنيوية التي اكتشفناها سابقًا

## 6.1 دوال SECURITY DEFINER المفتوحة
الخطر:
- تجاوز RLS
- استدعاء مباشر من العميل
- تعديل مالي غير موثّق

## 6.2 الاعتماد على العميل لإكمال الحلقة
الخطر:
- تأكيد بدون سند
- تأكيد بدون زيادة عداد
- دين يظل بحالة ناقصة

## 6.3 الاعتماد على نصوص حرة
الخطر:
- اكتشاف نوع العملية من `description`
- هشاشة شديدة وسوء تصنيف

## 6.4 ترقيم غير ذري
الخطر:
- `MAX + 1` بدون lock
- تكرار رقم السند تحت الضغط المتزامن

---

# 7) قواعد إلزامية لأي تطوير لاحق

1. أي انتقال مالي نهائي يجب أن يمر عبر Trigger أو DB function موثّقة.
2. أي RPC مالية داخلية تُغلق فور إنشائها.
3. أي حالة status جديدة يجب أن تُضاف في CHECK constraint بنفس الجلسة.
4. أي رقم تسلسلي حساس يجب أن يكون ذريًا.
5. أي ربط `linked_*` حساس يحتاج UNIQUE إن كان المنطق يمنع التكرار.
6. لا نعتبر أي إصلاح مكتملًا حتى تُراجع السلسلة كاملة:
   - إنشاء
   - تأكيد
   - Trigger/RPC
   - قيود DB
   - التوثيق النهائي

---

# 8) ملفات الإصلاحات المرجعية

- `supabase/gam3eya_turns.sql`
- `supabase/fix_installments.sql`
- `supabase/fix_sanad.sql`
- `supabase/fix_simple_debt.sql`
- `supabase/fix_p2p.sql`
- `supabase/fix_financial_function_grants.sql`

---

# 9) طبقات غير مالية لكنها حساسة

## 9.1 المصادقة (Auth)

### التسجيل
- `POST /api/auth/register`
- يعتمد على Supabase OTP / magic link
- يرسل إلى `auth/callback`

### إكمال البيانات
- `POST /api/auth/complete-profile`
- يتحقق من `accessToken`
- ينشئ `profiles` مع `phone` و `pin_hash` و `client_id`
- يستخدم `scryptSync(pin, email, 64)`

### تسجيل الدخول
- `POST /api/auth/login`
- يعتمد على `phone + pin`
- يتحقق من: `locked_until` و `email_verified`
- يولد magic link عبر `admin.auth.admin.generateLink`
- الحالة الحالية: تم تقويته بـ rate limiting + رد موحّد + `timingSafeEqual` + تأخير ثابت ضد enumeration/timing

### verify-pin (المرجع الأقوى)
- `POST /api/verify-pin`
- فيه: rate limiting طبقتين + `timingSafeEqual` + lockout
- هذا هو المرجع الذي ينبغي أن تتقارب معه بقية مسارات PIN

## 9.2 الشات (Chat)
- `POST /api/chat`
- طبقة قراءة وتحليل مالي
- ليس مسار تنفيذ مالي نهائي
- لكن أي خلل في `debt_requests` أو `settlements` ينعكس على الإجابات

## 9.3 الرفع (Upload)
- `POST /api/upload`
- الحمايات: rate limiting + حد 4MB + magic bytes + allowlist + service_role
- طبقة ممر آمن للملفات (إيصالات + ملفات شات)

## 9.4 الإدارة (Admin)
- `GET /api/admin/users` وغيرها
- التحقق: Cookie `admin_session` + `timingSafeEqual`
- يقرأ profiles بدون `pin_hash`
- تحتاج مراجعة موحّدة كاملة لاحقًا

---

# 10) ملاحظات المراجعة البنيوية المفتوحة

## 10.1 حالات status قديمة وغير موحّدة
- بعض الجداول بدأت بدون CHECK ثم أضيفت لاحقًا
- القاعدة: أي status جديد يضاف في نفس الجلسة

## 10.2 مسارات قديمة أضعف من الجديدة
- `verify-pin` قوي / `auth/login` أضعف
- القاعدة: لما نبني طبقة أقوى، نرجع نوحّد الأقدم عليها

## 10.3 دوال trigger handler يجب أن تكون مقفولة
- ثبت أن بعضها كان مفتوحًا لـ PUBLIC
- القاعدة: أي دالة `handle_*` أو `check_*` مالية تُقفل فورًا

---

# 11) ما يحتاج اختبار حي لاحقًا

1. تسوية جمعية → زيادة `gam3eya_completed`
2. تسوية قسط → زيادة `paid_installments`
3. اكتمال قسط نهائي → `status = completed`
4. تسوية دين بسيط → زيادة `settled_amount`
5. اكتمال دين بسيط → `status = settled`
6. تأكيد تسوية → إنشاء سند تلقائي
7. اكتمال P2P → إنشاء سند تلقائي
8. P2P dispute → حالات `disputed / refunded / expired`
9. عدم تكرار السند لنفس `linked_settlement_id` أو `linked_p2p_id`
10. التحقق الحي لمسارات auth بعد التقوية الأخيرة
11. مسارات `/api/admin/*` — مراجعة موحّدة لاحقة


---

# 12) الهيكل العام للواجهة ومسارات العرض

## 12.1 الصفحة الرئيسية `src/app/page.tsx`
الصفحة الرئيسية هي نقطة التجميع الأساسية، وتعمل داخل `AuthGate`.

### التبويبات الأساسية
- `chat` → `ChatView`
- `friends` → `FriendsView`
- `dashboard` → `PeopleView`
- `history` → `HistoryView`

### ملاحظات بنيوية
- التبويب الحالي يُحفظ في `localStorage` (`alrafeeq-tab`)
- `initSync()` يبدأ مباشرة عند تحميل الصفحة
- `handleLogout()` يمسح:
  - `KEYS.userId`
  - `KEYS.clientId`
  - ثم `supabase.auth.signOut()`

## 12.2 `AuthGate`
هو بوابة الواجهة الأساسية:
- يقرر هل المستخدم داخل أم لا
- يفعّل `auto-logout` بعد 10 دقائق خمول
- يمسح المفتاح الخاص من الذاكرة عند الخروج التلقائي
- يعيد المستخدم إلى `Splash` عند انتهاء الجلسة

هذا يعني أن طبقة المصادقة في الواجهة ليست مجرد check أولي، بل جزء من حماية الجلسة نفسها.

---

# 13) المحوران داخل الرفيق الأمين

الرفيق ليس تطبيقين منفصلين، بل تطبيق واحد فيه **محوران وظيفيان** نما معًا داخل نفس المنتج.

## 13.1 المحور الأول: المحادثة المالية العامة
هذا هو المسار الأساسي للرفيق الأمين.

### الفكرة
المستخدم يحكي، والرفيق يفهم ويصنف ويسجل ويعرض.

### الكيانات
- `transactions` (المعاملات الفردية)
- `chat_messages` (سجل المحادثة)
- `profiles` (البيانات الشخصية + الفئات المخصصة)

### الواجهات
- `ChatView` — المحادثة مع الرفيق
- `DashboardView` — الملخص المالي العام
- `HistoryView` — سجل المعاملات
- `PeopleView` — الأشخاص من المعاملات العامة

### مصادر البيانات
- `lib/store` (تخزين محلي + سحابي)
- `lib/sync` (مزامنة + طابور)
- `GET/POST /api/chat` (تحليل + رد)

### الأمان في هذا المحور
- المصادقة عبر `auth/*`
- PIN عبر `verify-pin`
- شات بـ rate limiting
- لا توجد تريغرات مالية حساسة هنا
- لكن `auth/*` تم تقويتها بالكامل (rate limiting + timingSafeEqual + uniform responses)

### ملاحظة
هذا المحور هو **النواة الأصلية** للرفيق.
بدأ بسيطًا ثم نما حتى أصبح قادرًا على فهم العامية وتصنيف المعاملات وعرض الملخصات.

---

## 13.2 المحور الثاني: الأصدقاء والعلاقات المالية الموثقة
هذا ليس تطبيقًا منفصلًا، بل **فرع داخل الرفيق** نما بشكل كبير.

### الفكرة
إدارة العلاقة المالية بين المستخدم وأشخاص بعينهم، مع توثيق وانتقالات حالة دقيقة.

### الكيانات
- `friendships` (العلاقات بين المستخدمين)
- `debt_requests` (الديون: بسيطة + أقساط)
- `settlements` (التسويات المرتبطة)
- `p2p_transactions` (الدفع الخارجي الموثق)
- `sanad_records` (السندات النهائية)
- `gam3eya_turns` (أدوار الجمعية)

### الواجهات
- `FriendsView` (المركز الأساسي لهذا المحور)

### مصادر البيانات
- مسارات `/api/friends/*`, `/api/settlement`, `/api/p2p/*`, `/api/sanad/*`, `/api/payment-methods/*`, `/api/relationship-change/*`
- تريغرات قاعدة البيانات (٤ على `settlements` + ١ على `debt_requests` + ٢ على `p2p_transactions`)

### الأمان في هذا المحور
- جميع التريغرات مالية وتلقائية
- جميع RPCs مقفولة على `service_role`
- `UNIQUE` + `CHECK` constraints كاملة
- `SECURITY DEFINER` على كل الدوال الداخلية
- ownership verification في كل route
- `expires_at` يُفحص فعليًا

### ملاحظة
هذا المحور هو **المحرك المالي الحساس** للرفيق.
كل ما يخص الديون والتسويات والسندات وP2P والجمعية والأقساط والدين البسيط يمر من هنا.

---

## 13.3 العلاقة بين المحورين

### كيف يتكاملان
1. المستخدم يستخدم **المحور الأول** (الشات) لتسجيل مصروفاته ودخله اليومي
2. المستخدم يستخدم **المحور الثاني** (الأصدقاء) لإدارة العلاقات المالية الموثقة

### نقطة التقاطع
- `FriendsView` يعرض رصيدًا بين طرفين
- هذا الرصيد محسوب من `debt_requests` + `settlements`
- لكن `PeopleView` يعرض رصيدًا من `transactions` فقط
- **هذا يعني أن المستخدم قد يرى رقمين مختلفين لنفس الشخص** بين التبويبين

### التحدّي المعماري
الهدف لاحقًا ليس "حذف طبقة قديمة"
بل:
> كيف نضمن أن **محور المحادثة** و**محور الأصدقاء** متكاملان بدون تعارض في مصدر الحقيقة؟

---

# 14) المزامنة والتخزين المحلي

## 14.1 `lib/sync.ts`
يوجد نظام مزامنة يعتمد على:
- طابور محلي للعمليات `queue`
- كشف online/offline
- مزامنة دورية كل 30 ثانية
- رفع عمليات محلية عند عودة الاتصال

### أنواع العمليات المدعومة في الطابور
- `add_tx`
- `delete_tx`
- `add_message`

### ملاحظة مهمة
هذا يعني أن جزءًا من سلوك التطبيق لا يزال **eventually consistent** وليس فوريًا بالكامل.
وفي طبقة مثل هذه، يجب الانتباه إلى:
- التكرار
- التزامن
- ازدواجية الإدراج
- الفرق بين local optimistic state وcloud state

## 14.2 `lib/keys.ts`
يوفر مصدرًا موحدًا لمفاتيح التخزين المحلي:
- معاملات
- محادثة
- طابور المزامنة
- آخر مزامنة
- الردود المتعلمة
- `clientId`
- `userId`

### ملاحظة بنيوية
وجود `userId` و`clientId` في التخزين المحلي يعني أن مسارات الواجهة تحتاج دائمًا مراجعة عند:
- logout
- auto-logout
- تبديل الحساب
- fallback behavior عند فقد الجلسة

---

# 15) واجهات العرض الرئيسية

## 15.1 `PeopleView` (محور المحادثة)
- يعرض الأشخاص من `transactions`
- يحسب صافي العلاقة من:
  - `expense` = أعطيت الشخص
  - `income` = رجع الشخص لك
- هذه واجهة **محور المحادثة العامة**

## 15.2 `HistoryView` (محور المحادثة)
- يعتمد على `lib/store`
- يدعم حذف المعاملات من التاريخ
- يصنّف حسب الفئات والوسيلة والوقت
- يمثل سجل المعاملات اليومية العامة

## 15.3 `DashboardView` (محور المحادثة)
- يعتمد على `getStats()`
- ملخص مالي عام من المعاملات
- هذه واجهة ملخص لمحور المحادثة

## 15.4 `FriendsView` (محور الأصدقاء)
- المركز الأساسي لمحور الأصدقاء
- يعرض:
  - الصداقات والعلاقات
  - الديون (بسيطة + أقساط)
  - التسويات
  - P2P
  - السندات
  - الجمعية
  - الرصيد الصافي بين طرفين
- مصدرها: قاعدة البيانات الحديثة + التريغرات

### ملاحظة معمارية
كل واجهة من المحور الأول تخدم المحور الأول فقط.
و `FriendsView` تخدم المحور الثاني فقط.
نقطة التقاطع الوحيدة هي أن المستخدم قد يرى نفس الشخص في تبويبين برقمين مختلفين.

---

# 16) الاتجاهات الثابتة المستخلصة من الكود

1. **المصدر النهائي للحقيقة المالية الحساسة يجب أن يبقى في قاعدة البيانات**
2. **الرفيق فيه محوران وظيفيان، وليس طبقتين منفصلتين**
3. **محور المحادثة العامة** = النواة الأصلية للرفيق (تسجيل + فهم + ملخصات)
4. **محور الأصدقاء** = الفرع الذي نما لإدارة العلاقات المالية الموثقة
5. **نقطة التقاطع الوحيدة بين المحورين** = أن المستخدم قد يرى نفس الشخص برقمين مختلفين
6. **أي إصلاح أمني لاحق يجب أن يحدد: هل هو في محور المحادثة أم محور الأصدقاء أم كليهما؟**

---

# 17) جلسات مراجعة لاحقة مقترحة

## 17.1 جلسة توحيد مصدر الحقيقة بين المحورين
- كيف نضمن أن المستخدم يرى رقمًا واحدًا متسقًا لنفس الشخص في تبويبي المحادثة والأصدقاء؟
- هل `transactions` تبقى كسجل للمحادثة فقط؟ أم تُربط بمحور الأصدقاء؟

## 17.2 جلسة مراجعة `lib/store`
- لأن `PeopleView` و`HistoryView` و`DashboardView` (محور المحادثة) تعتمد عليه
- وهو مؤثر على دقة ما يراه المستخدم

## 17.3 جلسة مراجعة `/api/admin/*`
- لأن طبقة الإدارة لم تُراجع بالكامل بعد بنفس العمق المالي
