import { Inject, Injectable } from '@nestjs/common';
import { catalogueId } from '../common/id.js';
import { toNumber } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeliveryRow } from './deliveries.types.js';
import type { DeliveryStep } from './delivery.rules.js';

/** What the list needs from a delivery, with its order number and product name. */
export const deliverySelect = {
  id: true,
  deliveryNumber: true,
  orderId: true,
  customerId: true,
  productId: true,
  quantity: true,
  totalPrice: true,
  deliveryAddress: true,
  status: true,
  isCompleted: true,
  deliveredAt: true,
  createdAt: true,
  order: { select: { orderNumber: true } },
  product: { select: { name: true } },
} as const;

type DeliveryRecord = {
  id: bigint;
  deliveryNumber: string;
  orderId: bigint;
  customerId: string;
  productId: bigint;
  quantity: number;
  totalPrice: { toString(): string };
  deliveryAddress: string;
  status: DeliveryRow['status'];
  isCompleted: boolean;
  deliveredAt: Date | null;
  createdAt: Date;
  order: { orderNumber: string };
  product: { name: string };
};

export function toDeliveryRow(record: DeliveryRecord): DeliveryRow {
  return {
    id: catalogueId(record.id),
    deliveryNumber: record.deliveryNumber,
    orderId: catalogueId(record.orderId),
    orderNumber: record.order.orderNumber,
    customerId: record.customerId,
    productId: catalogueId(record.productId),
    productName: record.product.name,
    quantity: record.quantity,
    totalPrice: toNumber(record.totalPrice),
    deliveryAddress: record.deliveryAddress,
    status: record.status,
    isCompleted: record.isCompleted,
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

/** SCRUM-34. The delivery list and status changes of the product manager. */
@Injectable()
export class DeliveriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Oldest open delivery first: processing, then in transit, then delivered, and the oldest
   * first inside each. PostgreSQL sorts an enum by the order its values were declared in
   * (processing, in_transit, delivered, cancelled), which is exactly that order.
   */
  async list(status?: DeliveryStep): Promise<DeliveryRow[]> {
    const rows = await this.prisma.delivery.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: deliverySelect,
    });
    return rows.map(toDeliveryRow);
  }
}
