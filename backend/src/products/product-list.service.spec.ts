import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  parseCategorySlug,
  ProductListService,
} from './product-list.service.js';
import { PRODUCT_SUMMARY_SELECT } from './product.select.js';

describe('ProductListService', () => {
  const product = { findMany: vi.fn() };
  const category = { findUnique: vi.fn(), findMany: vi.fn() };
  let service: ProductListService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProductListService({ product, category } as never);
  });

  const dbRow = (overrides: Record<string, unknown> = {}) => ({
    id: 3n,
    name: 'Court Vision Elite',
    model: 'RLY-2026-02',
    serialNumber: 'R-89878',
    description: 'Basketball shoe',
    stockQuantity: 8,
    price: '145.00',
    discountRate: '0.00',
    warrantyStatus: 'active',
    warrantyTerm: '12 months',
    distributor: 'Peak Performance Ltd.',
    imageUrl: null,
    popularity: 94,
    averageRating: '4.70',
    reviewCount: 89,
    category: { name: 'Basketball', slug: 'basketball' },
    ...overrides,
  });

  describe('listProducts', () => {
    it('lists every visible product, most popular first', async () => {
      product.findMany.mockResolvedValue([dbRow()]);
      const list = await service.listProducts();

      expect(category.findUnique).not.toHaveBeenCalled();
      expect(product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
        select: PRODUCT_SUMMARY_SELECT,
      });
      expect(list).toEqual([
        expect.objectContaining({
          id: 3,
          name: 'Court Vision Elite',
          category: 'Basketball',
          categorySlug: 'basketball',
          price: 145,
          stock: 8,
          inStock: true,
        }),
      ]);
    });

    it('filters by category slug', async () => {
      category.findUnique.mockResolvedValue({ id: 1n });
      product.findMany.mockResolvedValue([]);
      await service.listProducts('basketball');

      expect(category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'basketball' },
        select: { id: true },
      });
      expect(product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, category: { slug: 'basketball' } },
        }),
      );
    });

    it('returns an empty list for a category with no products', async () => {
      category.findUnique.mockResolvedValue({ id: 1n });
      product.findMany.mockResolvedValue([]);
      await expect(service.listProducts('gym')).resolves.toEqual([]);
    });

    it('throws 404 for a category that does not exist', async () => {
      category.findUnique.mockResolvedValue(null);
      await expect(service.listProducts('curling')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(product.findMany).not.toHaveBeenCalled();
    });

    it('keeps out-of-stock products in the list but marks them', async () => {
      product.findMany.mockResolvedValue([dbRow({ stockQuantity: 0 })]);
      const [item] = await service.listProducts();
      expect(item).toMatchObject({ stock: 0, inStock: false });
    });

    it('never selects the product cost', () => {
      expect(PRODUCT_SUMMARY_SELECT).not.toHaveProperty('cost');
    });
  });

  describe('listCategories', () => {
    it('returns categories in display order with visible product counts', async () => {
      category.findMany.mockResolvedValue([
        { id: 2n, name: 'Running', slug: 'running', _count: { products: 4 } },
        { id: 5n, name: 'Gym', slug: 'gym', _count: { products: 0 } },
      ]);
      const list = await service.listCategories();

      expect(category.findMany).toHaveBeenCalledWith({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      });
      expect(list).toEqual([
        { id: 2, name: 'Running', slug: 'running', productCount: 4 },
        { id: 5, name: 'Gym', slug: 'gym', productCount: 0 },
      ]);
    });
  });
});

describe('parseCategorySlug', () => {
  it('treats a missing or empty value as "all categories"', () => {
    expect(parseCategorySlug(undefined)).toBeUndefined();
    expect(parseCategorySlug('')).toBeUndefined();
  });

  it('accepts lowercase hyphenated slugs', () => {
    expect(parseCategorySlug('running')).toBe('running');
    expect(parseCategorySlug('gym-gear')).toBe('gym-gear');
  });

  it.each([
    'Running',
    'gym gear',
    '-gym',
    'gym--gear',
    "x' OR 1=1",
    ['running', 'gym'],
    'a'.repeat(81),
  ])('rejects %j', (raw) => {
    expect(() => parseCategorySlug(raw)).toThrow(BadRequestException);
  });
});
