import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MAX_SEARCH_LENGTH,
  parseCategorySlug,
  parseSearchQuery,
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
      await service.listProducts({ categorySlug: 'basketball' });

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
      await expect(
        service.listProducts({ categorySlug: 'gym' }),
      ).resolves.toEqual([]);
    });

    it('throws 404 for a category that does not exist', async () => {
      category.findUnique.mockResolvedValue(null);
      await expect(
        service.listProducts({ categorySlug: 'curling' }),
      ).rejects.toBeInstanceOf(NotFoundException);
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

  describe('listProducts search (SCRUM-28)', () => {
    const nameOrDescription = (contains: string) => ({
      OR: [
        { name: { contains, mode: 'insensitive' } },
        { description: { contains, mode: 'insensitive' } },
      ],
    });

    it('matches products whose name or description contains every word', async () => {
      product.findMany.mockResolvedValue([dbRow()]);
      await service.listProducts({ search: ['court', 'shoe'] });

      expect(product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            AND: [nameOrDescription('court'), nameOrDescription('shoe')],
          },
        }),
      );
    });

    it('combines a search with a category filter', async () => {
      category.findUnique.mockResolvedValue({ id: 1n });
      product.findMany.mockResolvedValue([]);
      await service.listProducts({ categorySlug: 'running', search: ['pro'] });

      expect(product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            category: { slug: 'running' },
            AND: [nameOrDescription('pro')],
          },
        }),
      );
    });

    it('escapes LIKE wildcards so they only match themselves', async () => {
      product.findMany.mockResolvedValue([]);
      await service.listProducts({ search: ['100%', 'a_b', 'c\\d'] });

      expect(product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            AND: [
              nameOrDescription('100\\%'),
              nameOrDescription('a\\_b'),
              nameOrDescription('c\\\\d'),
            ],
          },
        }),
      );
    });

    it('returns an empty list when nothing matches', async () => {
      product.findMany.mockResolvedValue([]);
      await expect(
        service.listProducts({ search: ['curling'] }),
      ).resolves.toEqual([]);
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

describe('parseSearchQuery', () => {
  it('treats a missing or blank search as no search', () => {
    expect(parseSearchQuery(undefined)).toBeUndefined();
    expect(parseSearchQuery('')).toBeUndefined();
    expect(parseSearchQuery('   ')).toBeUndefined();
  });

  it('splits the text into lowercase words without repeats', () => {
    expect(parseSearchQuery('  Trail  RUNNING shoe trail ')).toEqual([
      'trail',
      'running',
      'shoe',
    ]);
  });

  it('accepts exactly the maximum length', () => {
    expect(parseSearchQuery('a'.repeat(MAX_SEARCH_LENGTH))).toHaveLength(1);
  });

  it.each([
    ['too long', 'a'.repeat(MAX_SEARCH_LENGTH + 1)],
    ['too many words', 'a b c d e f g h i'],
    ['repeated parameter', ['shoe', 'ball']],
    ['object', { contains: 'x' }],
  ])('rejects a %s', (_label, raw) => {
    expect(() => parseSearchQuery(raw)).toThrow(BadRequestException);
  });
});
