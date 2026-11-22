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

/** Longest search a customer can type. Longer input is rejected rather than silently cut. */
export const MAX_SEARCH_LENGTH = 100;
/** Words in one search. Each word becomes a database condition, so the number is capped. */
const MAX_SEARCH_WORDS = 8;

/**
 * SCRUM-28. Splits the search box text into lowercase words, or returns undefined for an empty
 * search. A product matches when every word appears in its name or its description.
 */
export function parseSearchQuery(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || raw.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestException(
      `Search text must be at most ${MAX_SEARCH_LENGTH} characters.`,
    );
  }
  const words = [
    ...new Set(raw.trim().toLowerCase().split(/\s+/).filter(Boolean)),
  ];
  if (words.length === 0) return undefined;
  if (words.length > MAX_SEARCH_WORDS) {
    throw new BadRequestException(
      `Search for at most ${MAX_SEARCH_WORDS} words at a time.`,
    );
  }
  return words;
}

/** SCRUM-29. The orders the shop offers. Price means the price the customer pays (after discount). */
export const PRODUCT_SORTS = ['popularity', 'price-asc', 'price-desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** Most popular first when no order is given. Rejects an order the shop does not offer. */
export function parseSort(raw: unknown): ProductSort {
  if (raw === undefined || raw === '') return 'popularity';
  if (
    typeof raw !== 'string' ||
    !(PRODUCT_SORTS as readonly string[]).includes(raw)
  ) {
    throw new BadRequestException(
      `Sort must be one of: ${PRODUCT_SORTS.join(', ')}.`,
    );
  }
  return raw as ProductSort;
}

/** Filters and order for the shop list. Every field is optional. */
export interface ProductListQuery {
  categorySlug?: string;
  /** Lowercase words from parseSearchQuery. */
  search?: string[];
  sort?: ProductSort;
}

/** Postgres LIKE treats % and _ as wildcards and a backslash as the escape character. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class ProductListService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * SCRUM-13, 28 and 29. Every product a customer can see, optionally only one category and only
   * the ones that match a search, most popular first or by price. Out-of-stock products are still
   * listed (the card says so); products removed by a manager are not.
   */
  async listProducts({
    categorySlug,
    search,
    sort = 'popularity',
  }: ProductListQuery = {}): Promise<ProductSummaryResponse[]> {
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
        ...(search?.length
          ? {
              AND: search.map((word) => {
                const contains = escapeLike(word);
                return {
                  OR: [
                    { name: { contains, mode: 'insensitive' as const } },
                    { description: { contains, mode: 'insensitive' as const } },
                  ],
                };
              }),
            }
          : {}),
      },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
      select: PRODUCT_SUMMARY_SELECT,
    });
    const products = rows.map(toProductSummary);

    // The price a customer sees depends on the discount, so it cannot be sorted by the price
    // column alone. The list is small, and Array.prototype.sort is stable: products with the same
    // price stay most popular first.
    if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
    return products;
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
