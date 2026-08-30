// أنواع البيانات الأساسية لتطبيق الرفيق

export type TxType = 'expense' | 'income';

export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'bank' | 'unknown';

export type MainCategory = 'personal' | 'work';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  main: MainCategory;
  method: PaymentMethod;
  note: string;
  person?: string;
  createdAt: string;
}

export interface Proposal {
  type: TxType;
  amount: number;
  category: string;
  main: MainCategory;
  method: PaymentMethod;
  note: string;
}

export interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
  proposal?: Proposal;
}
