import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaCartStore, PrismaProductLookup } from './cart.prisma.js';

const GUEST = 'guest:3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

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

describe('PrismaCartStore.load', () => {
  it('returns an empty list when the owner has no cart', async () => {
    const { prisma, service } = fakePrisma();
    prisma.cart.findUnique.mockResolvedValue(null);

    await expect(
      new PrismaCartStore(service).load('guest:token-value-1234'),
    ).resolves.toEqual([]);
    expect(prisma.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guestToken: 'token-value-1234' } }),
    );
  });

  it('turns stored product ids into strings', async () => {
    const { prisma, service } = fakePrisma();
    prisma.cart.findUnique.mockResolvedValue({
      items: [{ productId: 42n, quantity: 3 }],
    });

    await expect(
      new PrismaCartStore(service).load('user:user-uuid'),
    ).resolves.toEqual([{ productId: '42', quantity: 3 }]);
    expect(prisma.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-uuid' } }),
    );
  });
});

describe('PrismaCartStore.merge (SCRUM-17)', () => {
  it('locks the guest cart, then the customer cart, and empties the guest cart in the same transaction', async () => {
    const { prisma, tx, service } = fakePrisma();
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 7n }])
      .mockResolvedValueOnce([{ id: 8n }]);
    tx.cartItem.findMany
      .mockResolvedValueOnce([{ productId: 3n, quantity: 2 }])
      .mockResolvedValueOnce([]);
    const change = vi.fn(() => [{ productId: '3', quantity: 2 }]);

    await new PrismaCartStore(service).merge(GUEST, 'user:user-uuid', change);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('guest_token');
    expect(tx.$queryRaw.mock.calls[1][0].join('?')).toContain('user_id');
    expect(change).toHaveBeenCalledWith(
      [{ productId: '3', quantity: 2 }],
      [],
    );
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 8n },
    });
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 7n },
    });
  });

  it('writes nothing when the guest cart is empty', async () => {
    const { tx, service } = fakePrisma();
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 7n }])
      .mockResolvedValueOnce([{ id: 8n }]);
    const change = vi.fn(() => []);

    await new PrismaCartStore(service).merge(GUEST, 'user:user-uuid', change);

    expect(change).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.cartItem.createMany).not.toHaveBeenCalled();
  });
});

describe('PrismaCartStore.update', () => {
  it('creates or locks the cart and replaces its items inside one transaction', async () => {
    const { prisma, tx, service } = fakePrisma();
    tx.cartItem.findMany.mockResolvedValue([{ productId: 3n, quantity: 1 }]);
    const change = vi.fn(() => [
      { productId: '3', quantity: 2 },
      { productId: '9', quantity: 1 },
    ]);

    const result = await new PrismaCartStore(service).update(GUEST, change);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
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

  it('locks a signed-in customer’s cart by user id', async () => {
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

  it('empties the stored cart without inserting rows when the change empties it', async () => {
    const { tx, service } = fakePrisma();

    await new PrismaCartStore(service).update(GUEST, () => []);

    expect(tx.cartItem.deleteMany).toHaveBeenCalled();
    expect(tx.cartItem.createMany).not.toHaveBeenCalled();
  });

  it('writes nothing when the change is rejected', async () => {
    const { tx, service } = fakePrisma();

    await expect(
      new PrismaCartStore(service).update(GUEST, () => {
        throw new Error('Only 5 left in stock.');
      }),
    ).rejects.toThrow('Only 5 left in stock.');
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.cartItem.createMany).not.toHaveBeenCalled();
  });
});

describe('PrismaProductLookup', () => {
  it.each(['shoe-1', 'abc', '0', '-1', '', '9'.repeat(19)])(
    'returns null for the invalid id "%s" without querying the database',
    async (id) => {
      const { prisma, service } = fakePrisma();

      await expect(
        new PrismaProductLookup(service).findById(id),
      ).resolves.toBeNull();
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    },
  );

  it('returns the stock of an active product', async () => {
    const { prisma, service } = fakePrisma();
    prisma.product.findFirst.mockResolvedValue({ id: 42n, stockQuantity: 5 });

    await expect(
      new PrismaProductLookup(service).findById('42'),
    ).resolves.toEqual({ id: '42', stock: 5 });
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42n, isActive: true } }),
    );
  });

  it('looks up the largest BIGINT id, like the product page does', async () => {
    const { prisma, service } = fakePrisma();
    prisma.product.findFirst.mockResolvedValue(null);

    await new PrismaProductLookup(service).findById('9223372036854775807');
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9223372036854775807n, isActive: true },
      }),
    );
  });

  it('returns null when the product does not exist or is inactive', async () => {
    const { prisma, service } = fakePrisma();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      new PrismaProductLookup(service).findById('99'),
    ).resolves.toBeNull();
  });
});
