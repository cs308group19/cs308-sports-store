import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { catalogueId } from '../common/id.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const submittedReview = {
  id: true,
  rating: true,
  comment: true,
  commentStatus: true,
} as const;

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submit(userId: string, orderItemId: bigint, rating: number, comment?: string) {
    const review = await this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: { id: orderItemId, order: { userId } },
        select: {
          orderId: true,
          productId: true,
          deliveries: {
            where: { status: 'delivered' },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!item) throw new NotFoundException('Order item not found.');
      if (!item.deliveries.length) {
        throw new ConflictException('You can review an order item after delivery.');
      }

      // Serialize ratings of the same product so the aggregate includes concurrently saved ratings.
      await tx.$queryRaw`SELECT id FROM public.products WHERE id = ${item.productId} FOR NO KEY UPDATE`;
      const existing = await tx.review.findUnique({
        where: { orderItemId },
        select: { ...submittedReview, userId: true },
      });

      if (existing) {
        if (existing.userId !== userId || existing.comment !== null || !comment || existing.rating !== rating) {
          throw new ConflictException('You have already rated this order item.');
        }
        // A customer who originally chose a rating only can add one comment later.
        return tx.review.update({
          where: { id: existing.id },
          data: { comment, commentStatus: 'pending', moderatedBy: null, moderatedAt: null },
          select: submittedReview,
        });
      }

      const created = await tx.review.create({
        data: { userId, orderItemId, orderId: item.orderId, productId: item.productId, rating, comment },
        select: submittedReview,
      });
      const totals = await tx.review.aggregate({
        where: { productId: item.productId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { averageRating: totals._avg.rating, reviewCount: totals._count._all },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return {
      id: catalogueId(review.id),
      rating: review.rating,
      commentStatus: review.comment === null ? null : review.commentStatus,
    };
  }
}
