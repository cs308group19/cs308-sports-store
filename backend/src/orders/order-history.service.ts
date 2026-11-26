import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toOrderHistoryItem } from './order-history.mapper.js';
import type { OrderHistoryItem } from './order-history.types.js';

/** Only what the order history page shows: the order, its lines and each product's photo. */
const orderHistorySelect = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  invoice: { select: { id: true } },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      productId: true,
      productName: true,
      productModel: true,
      quantity: true,
      unitPricePaid: true,
      lineTotal: true,
      product: { select: { imageUrl: true } },
      deliveries: {
        where: { status: 'delivered' as const },
        select: { id: true },
        take: 1,
      },
      review: { select: { rating: true, comment: true, commentStatus: true } },
    },
  },
};

/** SCRUM-27. The orders a customer has placed, newest first. */
@Injectable()
export class OrderHistoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Only the orders of `userId`. Another customer's orders are never returned. */
  async listForUser(userId: string): Promise<OrderHistoryItem[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: orderHistorySelect,
    });
    return rows.map(toOrderHistoryItem);
  }
}
