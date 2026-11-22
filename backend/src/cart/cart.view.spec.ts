import type { PrismaService } from '../prisma/prisma.service.js';
import { PRODUCT_SUMMARY_SELECT } from '../products/product.select.js';
import { CartViewService } from './cart.view.js';

/** SCRUM-16 and SCRUM-17. What the cart page receives after loading or changing the cart. */
const TOKEN = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

const productRow = (overrides: Record<string, unknown> = {}) => ({
  id: 3n,
  name: 'Court Vision Elite',
  model: 'RLY-2026-02',
  serialNumber: 'R-89878',
  description: 'Basketball shoe',
  stockQuantity: 8,
  price: '145.00',
  discountRate: '20.00',
  warrantyStatus: 'active',
  warrantyTerm: '12 months',
  distributor: 'Peak Performance Ltd.',
  imageUrl: null,
  popularity: 94,
  averageRating: '4.70',
  reviewCount: 89,
  category: { name: 'Basketball', slug: 'basketball' },
  isActive: true,
  ...overrides,
});

function setup() {
  const cart = { findUnique: vi.fn() };
  const service = new CartViewService({ cart } as unknown as PrismaService);
  return { cart, service };
}

describe('CartViewService', () => {
  it('returns an empty cart for an owner who has none yet', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue(null);

    await expect(service.view(`guest:${TOKEN}`)).resolves.toEqual({
      items: [],
      total: 0,
    });
  });

  it('reads the guest cart by its token, lines in the order they were added', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({ items: [] });
    await service.view(`guest:${TOKEN}`);

    expect(cart.findUnique).toHaveBeenCalledWith({
      where: { guestToken: TOKEN },
      select: {
        items: {
          orderBy: { id: 'asc' },
          select: {
            quantity: true,
            product: { select: { ...PRODUCT_SUMMARY_SELECT, isActive: true } },
          },
        },
      },
    });
  });

  it('reads a signed-in customer’s cart by user id', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({ items: [] });
    await service.view('user:9b2d7c4e-1a3f-4e5b-8c6d-7e8f9a0b1c2d');

    expect(cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: '9b2d7c4e-1a3f-4e5b-8c6d-7e8f9a0b1c2d' },
      }),
    );
  });

  it('returns each line with the shop fields and the discounted price', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [{ quantity: 2, product: productRow() }],
    });
    const { items } = await service.view(`guest:${TOKEN}`);

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
    // 145.00 with 20% off is 116.00, so two cost 232.00.
    expect(items[0].lineTotal).toBe(232);
    expect(items[0].product).toMatchObject({
      id: 3,
      name: 'Court Vision Elite',
      price: 116,
      oldPrice: 145,
      stock: 8,
      inStock: true,
    });
    expect(items[0].product).not.toHaveProperty('cost');
    expect(items[0].product).not.toHaveProperty('isActive');
  });

  it('hides products a manager removed from the store', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [
        { quantity: 1, product: productRow({ id: 1n, isActive: false }) },
        {
          quantity: 4,
          product: productRow({ id: 2n, name: 'Still for sale' }),
        },
      ],
    });
    const { items } = await service.view(`guest:${TOKEN}`);

    expect(items.map((item) => item.product.name)).toEqual(['Still for sale']);
  });

  it('keeps a line whose product sold out, marked as out of stock', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [{ quantity: 1, product: productRow({ stockQuantity: 0 }) }],
    });
    const { items } = await service.view(`guest:${TOKEN}`);

    expect(items[0].product).toMatchObject({ stock: 0, inStock: false });
  });

  it('adds up the discounted line totals into the cart total, in cents', async () => {
    const { cart, service } = setup();
    const plain = (id: bigint, price: string) =>
      productRow({ id, price, discountRate: '0.00' });
    cart.findUnique.mockResolvedValue({
      items: [
        { quantity: 2, product: plain(1n, '40.50') },
        // 0.10 and 0.20 add up to 0.30 exactly, not 0.30000000000000004.
        { quantity: 1, product: plain(2n, '0.10') },
        { quantity: 1, product: plain(3n, '0.20') },
      ],
    });
    const view = await service.view(`guest:${TOKEN}`);

    expect(view.items.map((item) => item.lineTotal)).toEqual([81, 0.1, 0.2]);
    expect(view.total).toBe(81.3);
  });

  it('leaves removed products out of the total', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [
        { quantity: 1, product: productRow({ id: 1n, isActive: false }) },
        {
          quantity: 1,
          product: productRow({ id: 2n, price: '12.00', discountRate: '0.00' }),
        },
      ],
    });

    await expect(service.view(`guest:${TOKEN}`)).resolves.toMatchObject({
      total: 12,
    });
  });

  it('rejects an unknown owner key before touching the database', async () => {
    const { cart, service } = setup();
    await expect(service.view('admin:1')).rejects.toThrow();
    expect(cart.findUnique).not.toHaveBeenCalled();
  });
});
