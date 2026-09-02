// @ts-nocheck
// طبقة التخزين: محلي أولًا (خاص بكل مستخدم) ثم سحابة كنسخة احتياطية

import type { Transaction } from './types';
import { isSupabaseEnabled, getSupabase } from './supabase';
import { isOnline, addToQueue } from './sync';

const OLD_STORAGE_KEY = 'alrafeeq_transactions';
const STORAGE_PREFIX = 'alrafeeq_transactions_';

export function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function getUserId(): Promise<string | null> {
  if (!isSupabaseEnabled) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id || null;
}

function getLocal(uid: string): Transaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + uid);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Transaction[];
    return Array.isArray(arr) ? arr.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ) : [];
  } catch { return []; }
}

function saveLocal(uid: string, txs: Transaction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(txs));
  } catch {}
}

export async function getTransactions(): Promise<Transaction[]> {
  const uid = await getUserId();

  // تنظيف المفتاح القديم المشترك (ترحيل هادئ)
  if (typeof window !== 'undefined') {
    localStorage.removeItem(OLD_STORAGE_KEY);
  }

  // 1) محلي أولًا (مفتاح خاص بالمستخدم)
  if (uid) {
    const local = getLocal(uid);
    if (local.length > 0) return local;
  }

  // 2) السحابة كنسخة احتياطية
  if (isSupabaseEnabled && uid) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('transactions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const txs = data.map(rowToTx);
        saveLocal(uid, txs);
        return txs;
      }
    }
  }

  // 3) لا توجد بيانات
  return [];
}

function rowToTx(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    main: row.main,
    method: row.method,
    note: row.note || '',
    person: row.person || '',
    createdAt: row.created_at,
  };
}

export async function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  const uid = await getUserId();
  const full: Transaction = { ...tx, id: genId(), createdAt: new Date().toISOString() };

  // احفظ محليًا فورًا
  if (uid && typeof window !== 'undefined') {
    const all = getLocal(uid);
    all.unshift(full);
    saveLocal(uid, all);
  }

  // ارفع للسحابة لو متصل
  if (isSupabaseEnabled && uid && isOnline()) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('transactions').insert({
        user_id: uid,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        main: tx.main,
        method: tx.method,
        note: tx.note,
      }).select().single();
      if (!error && data) {
        const cloudTx = rowToTx(data);
        // حدّث المحلي بالـ id الصحيح من السحابة
        if (typeof window !== 'undefined') {
          const all = getLocal(uid);
          const idx = all.findIndex(t => t.id === full.id);
          if (idx >= 0) all[idx] = cloudTx;
          saveLocal(uid, all);
        }
        return cloudTx;
      }
    }
  }

  // لو غير متصل → أضف للطابور
  if (uid && !isOnline()) {
    addToQueue(uid, 'add_tx', tx);
  }

  return full;
}

export async function deleteTransaction(id: string): Promise<void> {
  const uid = await getUserId();

  // احذف من المحلي فورًا
  if (uid && typeof window !== 'undefined') {
    const all = getLocal(uid).filter(t => t.id !== id);
    saveLocal(uid, all);
  }

  // احذف من السحابة لو متصل
  if (isSupabaseEnabled && uid && isOnline()) {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from('transactions').delete().eq('id', id);
      if (!error) return;
    }
  }

  // لو غير متصل → أضف للطابور
  if (uid && !isOnline()) {
    addToQueue(uid, 'delete_tx', { id });
  }
}

export async function getStats() {
  const txs = await getTransactions();
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const byCategory: Record<string, number> = {};
  for (const t of txs.filter(x => x.type === 'expense')) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { income, expense, balance, count: txs.length, topCategories };
}
