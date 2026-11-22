import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProductDetail } from './product-detail.mapper.js';
import type { ProductDetailResponse } from './product-detail.types.js';

/** How many approved comments the detail page shows (newest first). */
export const DETAIL_COMMENT_LIMIT = 20;

@Injectable()
export class ProductDetailService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(id: bigint): Promise<ProductDetailResponse> {
    const row = await this.prisma.product.findFirst({
      // Products removed by a product manager are hidden from customers.
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        model: true,
        serialNumber: true,
        description: true,
        stockQuantity: true,
        price: true,
        discountRate: true,
        warrantyStatus: true,
        warrantyTerm: true,
        distributor: true,
        imageUrl: true,
        popularity: true,
        averageRating: true,
        reviewCount: true,
        // cost is deliberately not selected: it is for managers only.
        category: { select: { name: true, slug: true } },
        reviews: {
          where: { commentStatus: 'approved' },
          orderBy: { createdAt: 'desc' },
          take: DETAIL_COMMENT_LIMIT,
          select: {
            id: true,
            rating: true,
            comment: true,
            commentStatus: true,
            createdAt: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    if (!row) throw new NotFoundException('Product not found.');
    return toProductDetail(row);
  }
}
