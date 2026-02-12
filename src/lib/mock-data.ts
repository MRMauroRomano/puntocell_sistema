
import { Product, Customer, Sale, BillingConfig } from './types';

export const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'iPhone 15 Pro 128GB', category: 'Celulares', subCategory: 'Apple', price: 1200.00, stock: 15, minStock: 5 },
  { id: '2', name: 'Samsung Galaxy S24 Ultra', category: 'Celulares', subCategory: 'Samsung', price: 1350.00, stock: 4, minStock: 6 },
  { id: '7', name: 'Xiaomi Redmi Note 13', category: 'Celulares', subCategory: 'Xiaomi', price: 350.00, stock: 10, minStock: 3 },
  { id: '8', name: 'Motorola Edge 40', category: 'Celulares', subCategory: 'Motorola', price: 450.00, stock: 7, minStock: 2 },
  { id: '3', name: 'AirPods Pro (2da Gen)', category: 'Audio', price: 249.00, stock: 25, minStock: 10 },
  { id: '4', name: 'MacBook Pro 14" M3', category: 'Computación', price: 1999.00, stock: 8, minStock: 3 },
  { id: '5', name: 'Cargador Rápido 20W USB-C', category: 'Accesorios', price: 25.00, stock: 60, minStock: 20 },
  { id: '6', name: 'Sony WH-1000XM5', category: 'Audio', price: 399.00, stock: 12, minStock: 4 },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Juan Pérez', email: 'juan@example.com', phone: '123456789', balance: 450.20 },
  { id: 'c2', name: 'María García', email: 'maria@example.com', phone: '987654321', balance: 0.00 },
  { id: 'c3', name: 'Carlos López', email: 'carlos@example.com', phone: '456123789', balance: 1250.50 },
];

export const MOCK_BILLING_CONFIGS: BillingConfig[] = [
  { id: '1', name: 'TechStore Principal', cuit: '30-71112223-9', description: 'Facturación estándar' },
  { id: '2', name: 'TechStore Accesorios', cuit: '20-33444555-2', description: 'Monotributo / Otros' },
];

export const MOCK_SALES: Sale[] = [
  {
    id: 's1',
    date: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { productId: '5', productName: 'Cargador Rápido 20W USB-C', quantity: 2, price: 25.00, subtotal: 50.00 }
    ],
    subtotal: 50.00,
    tax: 10.50,
    total: 60.50,
    paymentMethod: 'cash',
    billingCuit: '30-71112223-9'
  }
];
