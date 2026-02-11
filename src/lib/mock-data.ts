
import { Product, Customer, Sale, InventoryMovement } from './types';

export const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Leche Entera 1L', sku: 'LEC-001', category: 'Lácteos', price: 1.50, stock: 45, minStock: 10 },
  { id: '2', name: 'Pan de Molde', sku: 'PAN-002', category: 'Panadería', price: 2.10, stock: 8, minStock: 15 },
  { id: '3', name: 'Arroz Extra 1kg', sku: 'ARR-003', category: 'Despensa', price: 0.95, stock: 120, minStock: 20 },
  { id: '4', name: 'Aceite de Oliva 500ml', sku: 'ACE-004', category: 'Despensa', price: 5.40, stock: 12, minStock: 5 },
  { id: '5', name: 'Detergente Líquido', sku: 'LIM-005', category: 'Limpieza', price: 8.90, stock: 25, minStock: 10 },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Juan Pérez', email: 'juan@example.com', phone: '123456789', balance: 45.20 },
  { id: 'c2', name: 'María García', email: 'maria@example.com', phone: '987654321', balance: 0.00 },
  { id: 'c3', name: 'Carlos López', email: 'carlos@example.com', phone: '456123789', balance: 125.50 },
];

export const MOCK_SALES: Sale[] = [
  {
    id: 's1',
    date: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { productId: '1', productName: 'Leche Entera 1L', quantity: 2, price: 1.50, subtotal: 3.00 }
    ],
    subtotal: 3.00,
    tax: 0.63,
    total: 3.63,
    paymentMethod: 'cash'
  }
];
