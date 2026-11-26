import type { PrismaService } from '../prisma/prisma.service.js';
import {
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  type SeedCategory,
  type SeedProduct,
} from './catalogue-seed.data.js';

/** The part of Prisma the seed uses, so tests can pass a fake. */
export type CatalogueSeedClient = Pick<PrismaService, 'category' | 'product'>;

export interface CatalogueSeedResult {
  categoriesCreated: number;
  productsCreated: number;
  /** Rows that already existed. They are left exactly as they are. */
  skipped: number;
}

/**
 * Adds the demo categories and products that are missing. Existing rows are never changed, so
 * running it again does not undo stock sold through orders or edits made by a product manager.
 */
export async function seedCatalogue(
  prisma: CatalogueSeedClient,
  categories: readonly SeedCategory[] = SEED_CATEGORIES,
  products: readonly SeedProduct[] = SEED_PRODUCTS,
): Promise<CatalogueSeedResult> {
  const result: CatalogueSeedResult = {
    categoriesCreated: 0,
    productsCreated: 0,
    skipped: 0,
  };
  const categoryIds = new Map<string, bigint>();

  for (const category of categories) {
    const existing = await prisma.category.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    });
    if (existing) {
      categoryIds.set(category.slug, existing.id);
      result.skipped++;
      continue;
    }
    const created = await prisma.category.create({
      data: category,
      select: { id: true },
    });
    categoryIds.set(category.slug, created.id);
    result.categoriesCreated++;
  }

  for (const product of products) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (categoryId === undefined) {
      throw new Error(
        `Product ${product.sku} uses unknown category "${product.categorySlug}".`,
      );
    }
    const existing = await prisma.product.findUnique({
      where: { sku: product.sku },
      select: { id: true },
    });
    if (existing) {
      result.skipped++;
      continue;
    }
    await prisma.product.create({
      data: {
        sku: product.sku,
        name: product.name,
        model: product.model,
        serialNumber: product.serialNumber,
        description: product.description,
        categoryId,
        stockQuantity: product.stock,
        price: product.price,
        discountRate: product.discountRate,
        cost: product.cost,
        warrantyStatus: product.warrantyStatus,
        warrantyTerm: product.warrantyTerm,
        distributor: product.distributor,
      },
      select: { id: true },
    });
    result.productsCreated++;
  }

  return result;
}
