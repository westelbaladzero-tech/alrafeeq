// ─── مدير المفاتيح الخاصة: تشفير محلي بالـ PIN ───
// المفتاح الخاص مشفّر بـ PIN في IndexedDB
// المفتاح المفكوك يعيش في الذاكرة فقط — لا يلمس القرص

const KEY_DB = "alrafeeq-keys";
const PRIV_KEY_STORE = "alrafeeq-priv-key-encrypted";

// ─── متغيّر بالذاكرة فقط — يُمحى عند إعادة تحميل الصفحة أو logout ───
let inMemoryPrivateKey: CryptoKey | null = null;

// ─── حماية من brute-force محلي (offline) ───
let unlockAttempts = 0;
let unlockLockedUntil = 0; // timestamp (ms) — 0 = غير مقفل

const MAX_FAST_ATTEMPTS = 3; // 3 محاولات سريعة قبل التباطؤ
const LOCKOUT_DELAYS = [5000, 10000, 30000, 60000, 300000, 900000]; // 5s → 15min

export function getUnlockStatus(): { locked: boolean; waitMs: number; attempts: number } {
  const now = Date.now();
  if (unlockLockedUntil > now) {
    return { locked: true, waitMs: unlockLockedUntil - now, attempts: unlockAttempts };
  }
  return { locked: false, waitMs: 0, attempts: unlockAttempts };
}

// ─── اشتق مفتاح تشفير (KEK) من الـ PIN ───
async function deriveKEK(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const pinKey = await crypto.subtle.importKey(
    "raw", Buffer.from(new TextEncoder().encode(pin)),
    "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 600000, hash: "SHA-256" },
    pinKey,
    { name: "AES-GCM", length: 256 },
    false, // غير قابل للاستخراج
    ["encrypt", "decrypt"]
  );
}

// ─── تخزين IndexedDB للمفتاح المشفّر ───
interface EncryptedKeyData {
  encryptedPrivateKey: ArrayBuffer;
  salt: number[];
  iv: number[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PRIV_KEY_STORE)) {
        db.createObjectStore(PRIV_KEY_STORE);
      }
      // احذف المتجر القديم غير المشفّر (migration)
      if (db.objectStoreNames.contains("alrafeeq-priv-key")) {
        db.deleteObjectStore("alrafeeq-priv-key");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveEncryptedKey(data: EncryptedKeyData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIV_KEY_STORE, "readwrite");
    tx.objectStore(PRIV_KEY_STORE).put(data, "priv-encrypted");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getEncryptedKey(): Promise<EncryptedKeyData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIV_KEY_STORE, "readonly");
    const req = tx.objectStore(PRIV_KEY_STORE).get("priv-encrypted");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ─── عند إنشاء الحساب أو أول مرة: خزّن المفتاح الخاص مشفّراً ───
export async function setupEncryptedPrivateKey(
  privateKeyRaw: ArrayBuffer, pin: string
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKEK(pin, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, kek, privateKeyRaw
  );

  await saveEncryptedKey({
    encryptedPrivateKey: encrypted,
    salt: Array.from(salt),
    iv: Array.from(iv),
  });
}

// ─── عند الدخول: فكّ تشفير المفتاح بالـ PIN ───
export async function unlockPrivateKey(pin: string): Promise<boolean> {
  // ─── تحقق من القفل المحلي ───
  const now = Date.now();
  if (unlockLockedUntil > now) {
    return false; // مقفل — لا تُجرّب
  }

  const stored = await getEncryptedKey();
  if (!stored) return false;

  const salt = new Uint8Array(stored.salt);
  const iv = new Uint8Array(stored.iv);
  const kek = await deriveKEK(pin, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, kek, stored.encryptedPrivateKey
    );
    inMemoryPrivateKey = await crypto.subtle.importKey(
      "pkcs8", decrypted,
      { name: "ECDH", namedCurve: "P-256" },
      false, ["deriveKey", "deriveBits"]
    );
    // نجاح ← صفّر العدّاد
    unlockAttempts = 0;
    unlockLockedUntil = 0;
    return true;
  } catch {
    // فشل ← زيادة العدّاد + تأخير تصاعدي
    unlockAttempts++;
    if (unlockAttempts > MAX_FAST_ATTEMPTS) {
      const delayIdx = Math.min(
        unlockAttempts - MAX_FAST_ATTEMPTS - 1,
        LOCKOUT_DELAYS.length - 1
      );
      unlockLockedUntil = now + LOCKOUT_DELAYS[delayIdx];
    }
    return false; // PIN خاطئ
  }
}

// ─── المفتاح النشط بالذاكرة (يستخدم في كل عملية) ───
export function getActivePrivateKey(): CryptoKey | null {
  return inMemoryPrivateKey;
}

// ─── قفل: امحُ المفتاح من الذاكرة ───
export function lockPrivateKey(): void {
  inMemoryPrivateKey = null;
}

// ─── هل يوجد مفتاح مشفّر مخزّن؟ ───
export async function hasEncryptedKey(): Promise<boolean> {
  const stored = await getEncryptedKey();
  return stored !== null;
}

// ─── هل المفتاح مفتوح (في الذاكرة)؟ ───
export function isKeyUnlocked(): boolean {
  return inMemoryPrivateKey !== null;
}
