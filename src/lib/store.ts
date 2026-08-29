// طبقة التخزين: localStorage كافتراضي + جاهزة لربط Supabase

import type { Transaction } from './types';

const STORAGE_KEY = 'alrafeeq_transactions';
const PIN_KEY = 'alrafeeq_pin';

export function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getTransactions(): Transaction[] {
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

export function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  const full: Transaction = {
    ...tx,
    id: genId(),
    createdAt: new Date().toISOString(),
  };
  const all = getTransactions();
  all.push(full);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  return full;
}

export function deleteTransaction(id: string): void {
  const all = getTransactions().filter(t => t.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function setPin(pin: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PIN_KEY, pin);
}

export function getPin(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PIN_KEY);
}

export function hasPin(): boolean {
  return getPin() !== null;
}

export function verifyPin(pin: string): boolean {
  return getPin() === pin;
}

export function clearPin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_KEY);
}

export function getStats() {
  const txs = getTransactions();
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
