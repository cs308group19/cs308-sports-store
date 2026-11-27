import type { PrismaService } from '../prisma/prisma.service.js';
import { CartViewService } from './cart.view.js';

/** SCRUM-16 and SCRUM-17. What the cart page receives after loading or changing the cart. */
const TOKEN = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

const productRow = (overrides: Record<string, unknown> = {}) => ({
  id: 3n,
  name: 'Court Vision Elite',
  model: 'CV-ELT-25',
  price: '145.00',
  discountRate: '20.00',
  imageUrl: 'court.webp',
  stockQuantity: 8,
  isActive: true,
  ...overrides,
});

function setup() {
  const cart = { findUnique: vi.fn() };
  const service = new CartViewService({ cart } as unknown as PrismaService);
  return { cart, service };
}

describe('CartViewService', () => {
  it('returns an empty cart with total zero for an owner who has none yet', async () => {
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

    expect(cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guestToken: TOKEN },
        select: {
          items: expect.objectContaining({ orderBy: { id: 'asc' } }),
        },
      }),
    );
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

  it('never reads the product cost', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({ items: [] });
    await service.view(`guest:${TOKEN}`);

    const [{ select }] = cart.findUnique.mock.calls[0] as [
      { select: { items: { select: { product: { select: object } } } } },
    ];
    expect(select.items.select.product.select).not.toHaveProperty('cost');
  });

  it('returns each line with the discounted price, the line total and the cart total', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [{ quantity: 2, product: productRow() }],
    });

    // 145.00 with 20% off is 116.00, so two cost 232.00.
    await expect(service.view(`guest:${TOKEN}`)).resolves.toEqual({
      items: [
        {
          productId: '3',
          name: 'Court Vision Elite',
          model: 'CV-ELT-25',
          price: 116,
          imageUrl: 'court.webp',
          stock: 8,
          quantity: 2,
          lineTotal: 232,
        },
      ],
      total: 232,
    });
  });

  it('adds up the line totals in cents', async () => {
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

  it('hides products a manager removed from the store, and leaves them out of the total', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [
        { quantity: 1, product: productRow({ id: 1n, isActive: false }) },
        {
          quantity: 1,
          product: productRow({
            id: 2n,
            name: 'Still for sale',
            price: '12.00',
            discountRate: '0.00',
          }),
        },
      ],
    });
    const view = await service.view(`guest:${TOKEN}`);

    expect(view.items.map((item) => item.name)).toEqual(['Still for sale']);
    expect(view.total).toBe(12);
  });

  it('keeps a line whose product sold out, with its stock at zero', async () => {
    const { cart, service } = setup();
    cart.findUnique.mockResolvedValue({
      items: [{ quantity: 1, product: productRow({ stockQuantity: 0 }) }],
    });
    const { items } = await service.view(`guest:${TOKEN}`);

    expect(items[0]).toMatchObject({ stock: 0, quantity: 1 });
  });

  it('rejects an unknown owner key before touching the database', async () => {
    const { cart, service } = setup();
    await expect(service.view('admin:1')).rejects.toThrow();
    expect(cart.findUnique).not.toHaveBeenCalled();
  });
});
