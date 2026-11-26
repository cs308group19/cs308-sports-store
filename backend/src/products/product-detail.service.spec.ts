import { NotFoundException } from '@nestjs/common';
import {
  DETAIL_COMMENT_LIMIT,
  ProductDetailService,
} from './product-detail.service.js';

describe('ProductDetailService', () => {
  const product = { findFirst: vi.fn() };
  let service: ProductDetailService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProductDetailService({ product } as never);
  });

  const dbRow = {
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
    reviews: [],
  };

  it('returns the mapped product', async () => {
    product.findFirst.mockResolvedValue(dbRow);
    const detail = await service.findById(3n);
    expect(detail).toMatchObject({
      id: 3,
      name: 'Court Vision Elite',
      stock: 8,
    });
  });

  it('only looks up active products', async () => {
    product.findFirst.mockResolvedValue(dbRow);
    await service.findById(3n);
    expect(product.findFirst.mock.calls[0][0].where).toEqual({
      id: 3n,
      isActive: true,
    });
  });

  it('does not select the manager-only cost column', async () => {
    product.findFirst.mockResolvedValue(dbRow);
    await service.findById(3n);
    expect(product.findFirst.mock.calls[0][0].select).not.toHaveProperty(
      'cost',
    );
  });

  it('loads only approved comments, newest first, with a limit', async () => {
    product.findFirst.mockResolvedValue(dbRow);
    await service.findById(3n);
    const reviews = product.findFirst.mock.calls[0][0].select.reviews;
    expect(reviews.where).toEqual({
      commentStatus: 'approved',
      comment: { not: null },
    });
    expect(reviews.orderBy).toEqual({ createdAt: 'desc' });
    expect(reviews.take).toBe(DETAIL_COMMENT_LIMIT);
  });

  it('throws 404 when the product does not exist or was removed', async () => {
    product.findFirst.mockResolvedValue(null);
    await expect(service.findById(99n)).rejects.toThrow(NotFoundException);
  });
});
