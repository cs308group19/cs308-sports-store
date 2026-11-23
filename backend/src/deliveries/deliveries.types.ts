import type { OrderStatus } from './delivery.rules.js';

/** One row of the product manager's delivery list. */
export interface DeliveryRow {
  id: number | string;
  deliveryNumber: string;
  orderId: number | string;
  orderNumber: string;
  customerId: string;
  productId: number | string;
  productName: string;
  quantity: number;
  totalPrice: number;
  deliveryAddress: string;
  status: OrderStatus;
  isCompleted: boolean;
  deliveredAt: string | null;
  createdAt: string;
}
