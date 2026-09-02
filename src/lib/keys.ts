// مفاتيح التخزين الموحّدة — مصدر واحد للحقيقة
// لا تكتب أسماء المفاتيح يدويًا في أي ملف آخر

export const KEYS = {
  // معاملات
  OLD_TRANSACTIONS: "alrafeeq_transactions",
  transactions: (uid: string) => `alrafeeq_transactions_${uid}`,

  // محادثة
  OLD_CHAT: "alrafeeq_chat_history",
  chat: (uid: string) => `alrafeeq_chat_history_${uid}`,

  // طابور المزامنة
  queue: (uid: string) => `alrafeeq_sync_queue_${uid}`,

  // آخر مزامنة
  lastSync: (uid: string) => `alrafeeq_last_sync_${uid}`,

  // ردود متعلمة
  learned: (uid: string) => `alrafeeq_learned_responses_${uid}`,

  // تنظيف لمرة واحدة
  oldCleaned: "alrafeeq_old_keys_cleaned",
};

// تنظيف المفاتيح القديمة المشتركة — مرة واحدة فقط
export function cleanOldKeys(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KEYS.oldCleaned)) return;
  localStorage.removeItem(KEYS.OLD_TRANSACTIONS);
  localStorage.removeItem(KEYS.OLD_CHAT);
  localStorage.setItem(KEYS.oldCleaned, "1");
}
