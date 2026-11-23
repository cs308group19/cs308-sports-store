import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { catalogueId } from '../common/id.js';
import { toNumber } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeliveryRow, DeliveryUpdateResult } from './deliveries.types.js';
import {
  checkTransition,
  type DeliveryStep,
  OrderStatus,
  orderStatusFromDeliveries,
} from './delivery.rules.js';

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

  /**
   * Moves one delivery forward and, in the same transaction, brings its order's status in line
   * with its delivery rows.
   *
   * The order row is locked first. Two managers who change two items of the same order at the
   * same time then take turns, so the second one sees the first one's committed row when it
   * works out the order status (without the lock both could read the other item as not yet
   * delivered, and a fully delivered order would stay in transit). Two managers who change the
   * same delivery also take turns, and the second one finds the new status and gets a 409. The
   * update itself is still conditional on the status that was read, as a second safeguard.
   */
  async updateStatus(
    id: bigint,
    next: OrderStatus,
  ): Promise<DeliveryUpdateResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const found = await tx.delivery.findUnique({
          where: { id },
          select: { orderId: true },
        });
        if (!found) throw new NotFoundException('Delivery not found.');
        const { orderId } = found;

        const [lockedOrder] = await tx.$queryRaw<{ status: OrderStatus }[]>`
        SELECT status FROM public.orders WHERE id = ${orderId}::bigint FOR UPDATE`;
        if (!lockedOrder) throw new NotFoundException('Delivery not found.');
        if (lockedOrder.status === OrderStatus.cancelled) {
          throw new ConflictException(
            'This order is cancelled, so its deliveries can no longer change.',
          );
        }

        // Read again under the lock: another manager may have moved the row while we waited.
        const current = await tx.delivery.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!current) throw new NotFoundException('Delivery not found.');

        const check = checkTransition(current.status, next);
        if (!check.allowed) throw new ConflictException(check.reason);

        const now = new Date();
        const done = next === OrderStatus.delivered;
        const { count } = await tx.delivery.updateMany({
          where: { id, status: current.status },
          data: {
            status: next,
            isCompleted: done,
            ...(done ? { deliveredAt: now } : {}),
            updatedAt: now,
          },
        });
        if (count === 0) {
          throw new ConflictException(
            'This delivery was changed by someone else. Refresh the list and try again.',
          );
        }

        const siblings = await tx.delivery.findMany({
          where: { orderId },
          select: { status: true },
        });
        const orderStatus =
          orderStatusFromDeliveries(siblings.map((row) => row.status)) ?? next;
        const order = await tx.order.update({
          where: { id: orderId },
          data: {
            status: orderStatus,
            ...(orderStatus === OrderStatus.delivered
              ? { deliveredAt: now }
              : {}),
            updatedAt: now,
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveredAt: true,
          },
        });

        const row = await tx.delivery.findUniqueOrThrow({
          where: { id },
          select: deliverySelect,
        });
        return {
          delivery: toDeliveryRow(row),
          order: {
            id: catalogueId(order.id),
            orderNumber: order.orderNumber,
            status: order.status,
            deliveredAt: order.deliveredAt?.toISOString() ?? null,
          },
        };
      },
      // Waiting for another manager's lock counts towards the timeout.
      { maxWait: 10_000, timeout: 15_000 },
    );
  }
}
