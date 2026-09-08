// ─── تشفير الرسائل من طرف لطرف (E2EE) ───
// يستخدم Web Crypto API: ECDH للمفاتيح + AES-GCM للتشفير
// المفتاح الخاص مشفّر بـ PIN في IndexedDB — يُفك بالذاكرة فقط

import {
  setupEncryptedPrivateKey,
  getActivePrivateKey,
  hasEncryptedKey,
} from "./e2e-key-manager";

// ─── توليد زوج مفاتيح (عام + خاص) + تشفير المحلي بالـ PIN ───
export async function generateKeyPair(pin: string) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  // صدّر المفتاح العام بصيغة base64
  const pubRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
  const pubB64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));
  // صدّر المفتاح الخاص ثم شفّره بالـ PIN قبل التخزين
  const privRaw = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  await setupEncryptedPrivateKey(privRaw, pin);
  return pubB64;
}

// ─── احصل على المفتاح الخاص النشط من الذاكرة ───
// المفتاح يجب أن يكون مفتوحاً بـ PIN أولاً (unlockPrivateKey)
export async function getPrivateKey(): Promise<CryptoKey | null> {
  return getActivePrivateKey();
}

// ─── استورد مفتاح عام من base64 ───
export async function importPublicKey(pubB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(pubB64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw", raw,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );
}

// ─── اشتق مفتاح AES مشترك ───
async function deriveSharedKey(
  myPriv: CryptoKey, theirPub: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPub },
    myPriv,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

// ─── شفّر رسالة ───
export async function encryptMessage(
  text: string, myPriv: CryptoKey, theirPubB64: string
): Promise<string> {
  const theirPub = await importPublicKey(theirPubB64);
  const sharedKey = await deriveSharedKey(myPriv, theirPub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, sharedKey, encoded
  );
  // ادمج iv + ciphertext في base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// ─── فكّ تشفير رسالة ───
export async function decryptMessage(
  encryptedB64: string, myPriv: CryptoKey, theirPubB64: string
): Promise<string> {
  try {
    const theirPub = await importPublicKey(theirPubB64);
    const sharedKey = await deriveSharedKey(myPriv, theirPub);
    const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, sharedKey, ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[فشل فك التشفير]";
  }
}

// ═══ النسخ الاحتياطي السحابي للمفتاح الخاص ═══
// المفتاح الخاص يُشفّر بالـ PIN قبل رفعه للسحاب
// لو ضاع من الجهاز ← المستخدم يدخل PIN ← يُسترجع

// ─── اشتق مفتاح AES من الـ PIN ───
async function derivePinKey(pin: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(pin + salt),
    "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

// ─── شفّر المفتاح الخاص بالـ PIN للنسخ الاحتياطي ───
export async function encryptPrivateKeyForBackup(
  privKey: CryptoKey, pin: string, userSalt: string
): Promise<string> {
  // صدّر المفتاح الخاص كـ pkcs8
  const privRaw = await crypto.subtle.exportKey("pkcs8", privKey);
  const pinKey = await derivePinKey(pin, userSalt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, pinKey, privRaw
  );
  // ادمج iv + ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// ─── فكّ تشفير المفتاح الخاص من النسخة السحابية ───
export async function decryptPrivateKeyFromBackup(
  encB64: string, pin: string, userSalt: string
): Promise<CryptoKey | null> {
  try {
    const pinKey = await derivePinKey(pin, userSalt);
    const combined = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, pinKey, ciphertext
    );
    // استورد المفتاح الخاص المفكوك
    return await crypto.subtle.importKey(
      "pkcs8", decrypted,
      { name: "ECDH", namedCurve: "P-256" },
      true, ["deriveKey", "deriveBits"]
    );
  } catch {
    return null;
  }
}

// ─── صدّر المفتاح الخاص كـ ArrayBuffer (للتخزين المحلي) ───
export async function exportPrivateKeyRaw(privKey: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.exportKey("pkcs8", privKey);
}
