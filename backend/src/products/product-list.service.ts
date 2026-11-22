import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProductSummary } from './product-detail.mapper.js';
import type { ProductSummaryResponse } from './product-detail.types.js';
import type { CategoryResponse } from './product-list.types.js';
import { PRODUCT_SUMMARY_SELECT } from './product.select.js';

/** Category slugs are lowercase words joined by single hyphens, e.g. "running" or "gym-gear". */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Returns the slug, or undefined when no category filter was given. Rejects anything else. */
export function parseCategorySlug(raw: unknown): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string' || raw.length > 80 || !SLUG_PATTERN.test(raw)) {
    throw new BadRequestException('Invalid category.');
  }
  return raw;
}

@Injectable()
export class ProductListService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * SCRUM-13. Every product a customer can see, optionally only one category. Out-of-stock
   * products are still listed (the card says so); products removed by a manager are not.
   * Most popular first, so the list has a stable default order before search and sort exist.
   */
  async listProducts(
    categorySlug?: string,
  ): Promise<ProductSummaryResponse[]> {
    if (categorySlug !== undefined) {
      const category = await this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (!category) throw new NotFoundException('Category not found.');
    }

    const rows = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categorySlug !== undefined
          ? { category: { slug: categorySlug } }
          : {}),
      },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
      select: PRODUCT_SUMMARY_SELECT,
    });
    return rows.map(toProductSummary);
  }

  /** SCRUM-13. Categories for the shop sidebar and the home page, with how many products each has. */
  async listCategories(): Promise<CategoryResponse[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      productCount: row._count.products,
    }));
  }
}
