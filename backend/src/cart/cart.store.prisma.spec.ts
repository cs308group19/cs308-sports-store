import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaCartStore, PrismaProductLookup } from './cart.store.prisma.js';

const OWNER = 'guest:3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

function fakePrisma() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 7n }]),
    cartItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    cart: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return { prisma, tx, service: prisma as unknown as PrismaService };
}

describe('PrismaCartStore', () => {
  it('loads the items of the owner’s cart as strings', async () => {
    const { prisma, service } = fakePrisma();
    prisma.cart.findUnique.mockResolvedValue({
      items: [{ productId: 3n, quantity: 2 }],
    });

    await expect(new PrismaCartStore(service).load(OWNER)).resolves.toEqual([
      { productId: '3', quantity: 2 },
    ]);
    expect(prisma.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guestToken: '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69' },
      }),
    );
  });

  it('returns an empty cart when the owner has none yet', async () => {
    const { prisma, service } = fakePrisma();
    prisma.cart.findUnique.mockResolvedValue(null);

    await expect(new PrismaCartStore(service).load(OWNER)).resolves.toEqual([]);
  });

  it('creates or locks the cart and replaces its lines in one transaction', async () => {
    const { prisma, tx, service } = fakePrisma();
    tx.cartItem.findMany.mockResolvedValue([{ productId: 3n, quantity: 1 }]);
    const change = vi.fn(() => [
      { productId: '3', quantity: 2 },
      { productId: '9', quantity: 1 },
    ]);

    const result = await new PrismaCartStore(service).update(OWNER, change);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [sql, ...values] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(sql.join('?')).toMatch(
      /INSERT INTO public\.carts \(guest_token\)[\s\S]*ON CONFLICT \(guest_token\) DO UPDATE/,
    );
    expect(values).toEqual(['3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69']);
    expect(change).toHaveBeenCalledWith([{ productId: '3', quantity: 1 }]);
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 7n },
    });
    expect(tx.cartItem.createMany).toHaveBeenCalledWith({
      data: [
        { cartId: 7n, productId: 3n, quantity: 2 },
        { cartId: 7n, productId: 9n, quantity: 1 },
      ],
    });
    expect(result).toEqual([
      { productId: '3', quantity: 2 },
      { productId: '9', quantity: 1 },
    ]);
  });

  it('locks a signed-in user’s cart by user id', async () => {
    const { tx, service } = fakePrisma();

    await new PrismaCartStore(service).update('user:user-1', (items) => items);

    const [sql, ...values] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(sql.join('?')).toMatch(
      /VALUES \(\?::uuid\)[\s\S]*ON CONFLICT \(user_id\) DO UPDATE/,
    );
    expect(values).toEqual(['user-1']);
  });

  it('only clears the lines when the cart becomes empty', async () => {
    const { tx, service } = fakePrisma();

    await new PrismaCartStore(service).update(OWNER, () => []);

    expect(tx.cartItem.deleteMany).toHaveBeenCalled();
    expect(tx.cartItem.createMany).not.toHaveBeenCalled();
  });

  it('writes nothing when the change is rejected', async () => {
    const { tx, service } = fakePrisma();

    await expect(
      new PrismaCartStore(service).update(OWNER, () => {
        throw new Error('Only 5 left in stock.');
      }),
    ).rejects.toThrow('Only 5 left in stock.');
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.cartItem.createMany).not.toHaveBeenCalled();
  });
});

describe('PrismaProductLookup', () => {
  it('returns the stock of an active product', async () => {
    const { prisma, service } = fakePrisma();
    prisma.product.findFirst.mockResolvedValue({ id: 3n, stockQuantity: 12 });

    await expect(
      new PrismaProductLookup(service).findById('3'),
    ).resolves.toEqual({
      id: '3',
      stock: 12,
    });
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3n, isActive: true } }),
    );
  });

  it('returns null for a removed or missing product', async () => {
    const { prisma, service } = fakePrisma();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      new PrismaProductLookup(service).findById('3'),
    ).resolves.toBeNull();
  });

  it.each(['abc', '0', '-1', ''])(
    'does not query the database for the invalid id "%s"',
    async (id) => {
      const { prisma, service } = fakePrisma();

      await expect(
        new PrismaProductLookup(service).findById(id),
      ).resolves.toBeNull();
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    },
  );
});
