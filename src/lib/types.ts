
export interface Product {
  id: string;
  code: string; // 4-digit numeric code
  name: string;
  category: string; // Celulares, Audio, etc.
  subCategory?: string; // iPhone, Samsung, etc.
  condition: 'Nuevo' | 'Usado';
  price: number;
  stock: number;
  minStock: number;
  description?: string;
  isActive?: boolean;
  batteryHealth?: string; // New field for battery health (e.g. 100%, 85%)
  storage?: string; // New field for storage (e.g. 64GB, 128GB)
}

export interface Customer {
  id: string;
  name: string;
  cuit: string; // Tax ID
  email: string;
  phone: string;
  address?: string;
  balance: number; // Current debt
  accountType?: 'toti' | 'martin'; // New field for dividing accounts
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export type PaymentMethod = 
  | 'cash' 
  | 'debit' 
  | 'transfer' 
  | 'credit_account' 
  | 'cheque' 
  | 'visa' 
  | 'mastercard' 
  | 'cabal' 
  | 'premier' 
  | 'paselibre';

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
  status?: 'completed' | 'returned'; // New status field for AFIP compliance
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
  paymentMethod?: PaymentMethod;
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
