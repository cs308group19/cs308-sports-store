import { describe, expect, it, vi } from 'vitest';
import {
  validateCategoryName,
  validateProduct,
} from '../catalogue/catalogue.rules.js';
import { applyDiscount } from '../common/money.js';
import { seedCatalogue, type CatalogueSeedClient } from './catalogue-seed.js';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './catalogue-seed.data.js';

describe('demo catalogue data', () => {
  it('only contains products that pass the catalogue rules', () => {
    for (const product of SEED_PRODUCTS) {
      expect(validateProduct(product), product.sku).toEqual([]);
    }
  });

  it('only contains valid category names', () => {
    for (const category of SEED_CATEGORIES) {
      expect(validateCategoryName(category.name), category.slug).toBeNull();
    }
  });

  it('uses unique SKUs, serial numbers and category slugs', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(SEED_PRODUCTS.map((p) => p.sku))).toBe(true);
    expect(unique(SEED_PRODUCTS.map((p) => p.serialNumber))).toBe(true);
    expect(unique(SEED_CATEGORIES.map((c) => c.slug))).toBe(true);
  });

  it('puts every product in a seeded category and every category has products', () => {
    const slugs = new Set(SEED_CATEGORIES.map((c) => c.slug));
    for (const product of SEED_PRODUCTS) {
      expect(slugs.has(product.categorySlug), product.sku).toBe(true);
    }
    for (const slug of slugs) {
      expect(
        SEED_PRODUCTS.some((p) => p.categorySlug === slug),
        slug,
      ).toBe(true);
    }
  });

  it('includes out-of-stock and discounted products for the demo', () => {
    expect(SEED_PRODUCTS.some((p) => p.stock === 0)).toBe(true);
    expect(SEED_PRODUCTS.some((p) => p.discountRate > 0)).toBe(true);
  });

  it('never sells below cost after the discount', () => {
    for (const product of SEED_PRODUCTS) {
      expect(
        applyDiscount(product.price, product.discountRate),
        product.sku,
      ).toBeGreaterThan(product.cost);
    }
  });
});

describe('seedCatalogue', () => {
  const fakePrisma = (
    existingSlugs: string[] = [],
    existingSkus: string[] = [],
  ) => {
    let nextId = 100n;
    const prisma = {
      category: {
        findUnique: vi.fn(({ where }: { where: { slug: string } }) =>
          Promise.resolve(
            existingSlugs.includes(where.slug) ? { id: 1n } : null,
          ),
        ),
        create: vi.fn(() => Promise.resolve({ id: nextId++ })),
      },
      product: {
        findUnique: vi.fn(({ where }: { where: { sku: string } }) =>
          Promise.resolve(existingSkus.includes(where.sku) ? { id: 1n } : null),
        ),
        create: vi.fn(() => Promise.resolve({ id: nextId++ })),
      },
    };
    return prisma;
  };

  it('creates every category and product in an empty database', async () => {
    const prisma = fakePrisma();

    const result = await seedCatalogue(
      prisma as unknown as CatalogueSeedClient,
    );

    expect(result).toEqual({
      categoriesCreated: SEED_CATEGORIES.length,
      productsCreated: SEED_PRODUCTS.length,
      skipped: 0,
    });
  });

  it('maps seed fields to the database columns', async () => {
    const prisma = fakePrisma();
    const [category] = SEED_CATEGORIES;
    const product = SEED_PRODUCTS.find(
      (p) => p.categorySlug === category.slug,
    )!;

    await seedCatalogue(
      prisma as unknown as CatalogueSeedClient,
      [category],
      [product],
    );

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sku: product.sku,
        serialNumber: product.serialNumber,
        stockQuantity: product.stock,
        discountRate: product.discountRate,
        categoryId: 100n,
      }),
      select: { id: true },
    });
  });

  it('leaves rows that already exist untouched', async () => {
    const prisma = fakePrisma(
      SEED_CATEGORIES.map((c) => c.slug),
      SEED_PRODUCTS.map((p) => p.sku),
    );

    const result = await seedCatalogue(
      prisma as unknown as CatalogueSeedClient,
    );

    expect(result.categoriesCreated).toBe(0);
    expect(result.productsCreated).toBe(0);
    expect(prisma.category.create).not.toHaveBeenCalled();
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects a product whose category is not in the seed', async () => {
    const prisma = fakePrisma();

    await expect(
      seedCatalogue(
        prisma as unknown as CatalogueSeedClient,
        [],
        [SEED_PRODUCTS[0]],
      ),
    ).rejects.toThrow(/unknown category/);
  });
});
