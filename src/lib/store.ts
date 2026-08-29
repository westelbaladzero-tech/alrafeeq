// طبقة التخزين: Supabase عند توفّرها، localStorage كافتراضي

import type { Transaction } from './types';
import { isSupabaseEnabled, getSupabase } from './supabase';

const STORAGE_KEY = 'alrafeeq_transactions';
const PIN_KEY = 'alrafeeq_pin';

export function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ====== قراءة كل العمليات ======
export async function getTransactions(): Promise<Transaction[]> {
  if (isSupabaseEnabled) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(rowToTx);
      }
    }
  }
  // fallback localStorage
  return getLocal();
}

function getLocal(): Transaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Transaction[];
    return Array.isArray(arr) ? arr.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ) : [];
  } catch {
    return [];
  }
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
    createdAt: row.created_at,
  };
}

// ====== حفظ عملية جديدة ======
export async function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  if (isSupabaseEnabled) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('transactions').insert({
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        main: tx.main,
        method: tx.method,
        note: tx.note,
      }).select().single();
      if (!error && data) {
        return rowToTx(data);
      }
    }
  }
  // fallback localStorage
  const full: Transaction = { ...tx, id: genId(), createdAt: new Date().toISOString() };
  const all = getLocal();
  all.push(full);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  return full;
}

// ====== حذف عملية ======
export async function deleteTransaction(id: string): Promise<void> {
  if (isSupabaseEnabled) {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from('transactions').delete().eq('id', id);
      if (!error) return;
    }
  }
  const all = getLocal().filter(t => t.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

// ====== PIN للمصادقة المحلية ======
export function setPin(pin: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PIN_KEY, pin);
}
export function getPin(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PIN_KEY);
}
export function hasPin(): boolean { return getPin() !== null; }
export function verifyPin(pin: string): boolean { return getPin() === pin; }
export function clearPin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_KEY);
}

// ====== إحصائيات للوحة الملخصات ======
export async function getStats() {
  const txs = await getTransactions();
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const byCategory: Record<string, number> = {};
  for (const t of txs.filter(x => x.type === 'expense')) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return { income, expense, balance, count: txs.length, topCategories };
}
