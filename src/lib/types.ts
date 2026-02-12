
export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  price: number;
  stock: number;
  minStock: number;
  description?: string;
  isActive?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  cuit: string; // Tax ID
  email: string;
  phone: string;
  address?: string;
  balance: number; // Current debt
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'debit' | 'credit_card' | 'transfer' | 'credit_account';
export type InvoiceType = 'factura_a' | 'factura_b' | 'ticket';

export interface Sale {
  id: string;
  date: string;
  customerId?: string;
  customerName?: string;
  customerCuit?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  invoiceType: InvoiceType;
  billingCuit?: string; // CUIT used for this sale
  billingName?: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  date: string;
}

export interface AccountTransaction {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  type: 'purchase' | 'payment';
  description: string;
}

export interface BillingConfig {
  id: string;
  name: string;
  cuit: string;
  address?: string;
  ivaCondition?: string;
  description?: string;
}

export interface StoreSettings {
  storeName: string;
  billingConfigs: BillingConfig[];
}
