
export interface Professional {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  percentage: number;
  createdAt: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birthDate?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  grossValue: number;
  netClinic: number;
  professionalValue: number;
  professionalId: string;
  professionalName: string;
  serviceType: string;
  paymentMethod: 'pix' | 'dinheiro' | 'cartao' | 'unimed';
  date: string; // ISO String
}

export interface Expense {
  id: string;
  value: number;
  category: string;
  description: string;
  paymentMethod: string;
  date: string; // ISO String
}

export interface Product {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
}

export interface DailyConfig {
  date: string; // YYYY-MM-DD
  initialCash: number;
}
