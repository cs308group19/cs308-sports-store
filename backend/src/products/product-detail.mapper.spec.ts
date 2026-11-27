import {
  type ProductDetailRow,
  type ProductReviewRow,
  shortAuthorName,
  toProductDetail,
  toProductSummary,
} from './product-detail.mapper.js';

const review = (
  overrides: Partial<ProductReviewRow> = {},
): ProductReviewRow => ({
  id: 1n,
  rating: 5,
  comment: 'Great shoes',
  commentStatus: 'approved',
  createdAt: new Date('2026-11-20T10:00:00Z'),
  moderatedAt: null,
  user: { fullName: 'Jamie Taylor' },
  ...overrides,
});

const row = (overrides: Partial<ProductDetailRow> = {}): ProductDetailRow => ({
  id: 7n,
  name: 'AeroStride Pro',
  model: 'RLY-2025-01',
  serialNumber: 'R-89741',
  description: 'Lightweight running shoe',
  stockQuantity: 14,
  price: '159.00',
  discountRate: '0.00',
  warrantyStatus: 'active',
  warrantyTerm: '24 months',
  distributor: 'Northstar Athletics',
  imageUrl: 'https://example.com/shoe.jpg',
  popularity: 98,
  averageRating: '4.80',
  reviewCount: 126,
  category: { name: 'Running', slug: 'running' },
  reviews: [],
  ...overrides,
});

describe('toProductDetail', () => {
  it('returns every property the course requires (feature 9)', () => {
    const detail = toProductDetail(row());
    expect(detail).toMatchObject({
      id: 7,
      name: 'AeroStride Pro',
      model: 'RLY-2025-01',
      serial: 'R-89741',
      description: 'Lightweight running shoe',
      stock: 14,
      price: 159,
      warrantyStatus: 'Active',
      warranty: '24 months',
      distributor: 'Northstar Athletics',
      category: 'Running',
    });
  });

  it('never exposes the product cost', () => {
    const detail = toProductDetail({
      ...row(),
      cost: '50.00',
    } as ProductDetailRow);
    expect(detail).not.toHaveProperty('cost');
  });

  it('has no old price when there is no discount', () => {
    expect(toProductDetail(row())).not.toHaveProperty('oldPrice');
  });

  it('applies the discount and keeps the list price as oldPrice', () => {
    const detail = toProductDetail(row({ discountRate: '20.00' }));
    expect(detail.price).toBe(127.2);
    expect(detail.oldPrice).toBe(159);
    expect(detail.discountRate).toBe(20);
  });

  it('marks a product with zero stock as out of stock', () => {
    const detail = toProductDetail(row({ stockQuantity: 0 }));
    expect(detail.stock).toBe(0);
    expect(detail.inStock).toBe(false);
  });

  it('turns warranty enum values into readable labels', () => {
    expect(
      toProductDetail(row({ warrantyStatus: 'expired' })).warrantyStatus,
    ).toBe('Expired');
    expect(
      toProductDetail(row({ warrantyStatus: 'not_applicable' })).warrantyStatus,
    ).toBe('Not applicable');
  });

  it('converts the average rating to a number', () => {
    expect(toProductDetail(row()).rating).toBe(4.8);
  });

  it('shows approved comments only', () => {
    const detail = toProductDetail(
      row({
        reviews: [
          review({ id: 1n, commentStatus: 'approved' }),
          review({ id: 2n, commentStatus: 'pending' }),
          review({ id: 3n, commentStatus: 'rejected' }),
          review({ id: 4n, commentStatus: 'not_applicable', comment: null }),
        ],
      }),
    );
    expect(detail.comments.map((c) => c.id)).toEqual(['1']);
  });

  it('skips approved reviews whose comment is empty', () => {
    const detail = toProductDetail(
      row({ reviews: [review({ comment: '   ' }), review({ comment: null })] }),
    );
    expect(detail.comments).toEqual([]);
  });

  it('shortens the author name and sends the date as ISO text', () => {
    const [comment] = toProductDetail(row({ reviews: [review()] })).comments;
    expect(comment).toEqual({
      id: '1',
      rating: 5,
      comment: 'Great shoes',
      author: 'Jamie T.',
      createdAt: '2026-11-20T10:00:00.000Z',
      publishedAt: '2026-11-20T10:00:00.000Z',
    });
  });

  it('uses approval time for publication even when a rating was created earlier', () => {
    const [comment] = toProductDetail(
      row({
        reviews: [review({ moderatedAt: new Date('2026-11-25T10:00:00Z') })],
      }),
    ).comments;
    expect(comment).toMatchObject({
      createdAt: '2026-11-20T10:00:00.000Z',
      publishedAt: '2026-11-25T10:00:00.000Z',
    });
  });
});

describe('shortAuthorName', () => {
  it.each([
    ['Jamie Taylor', 'Jamie T.'],
    ['Naz Üstün', 'Naz Ü.'],
    ['Ali Veli yılmaz', 'Ali Y.'],
    ['Cher', 'Cher'],
    ['   ', 'Verified buyer'],
  ])('%j -> %j', (input, expected) => {
    expect(shortAuthorName(input)).toBe(expected);
  });
});

describe('toProductSummary', () => {
  it('has the same product fields as the detail page, without comments', () => {
    const { reviews: _reviews, ...summaryRow } = row({ reviews: [review()] });
    const summary = toProductSummary(summaryRow);
    const { comments, ...detailWithoutComments } = toProductDetail(
      row({ reviews: [review()] }),
    );
    expect(comments).toHaveLength(1);
    expect(summary).toEqual(detailWithoutComments);
    expect(summary).not.toHaveProperty('comments');
  });
});
