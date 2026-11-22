import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaCartStore, PrismaProductLookup } from './cart.prisma.js';

function fakePrisma() {
  const cart = {
    findUnique: vi.fn(),
    upsert: vi.fn(async () => ({ id: BigInt(7) })),
  };
  const cartItem = {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async () => ({ count: 0 })),
  };
  const product = { findFirst: vi.fn() };
  const prisma = {
    cart,
    cartItem,
    product,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ cart, cartItem }),
    ),
  };
  return { prisma, cart, cartItem, product };
}

describe('PrismaCartStore', () => {
  it('returns an empty list when the owner has no cart', async () => {
    const { prisma, cart } = fakePrisma();
    cart.findUnique.mockResolvedValue(null);

    await expect(
      new PrismaCartStore(prisma as unknown as PrismaService).load('guest:token-value-1234'),
    ).resolves.toEqual([]);
    expect(cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guestToken: 'token-value-1234' } }),
    );
  });

  it('turns stored product ids into strings', async () => {
    const { prisma, cart } = fakePrisma();
    cart.findUnique.mockResolvedValue({
      id: BigInt(7),
      items: [{ productId: BigInt(42), quantity: 3 }],
    });

    await expect(
      new PrismaCartStore(prisma as unknown as PrismaService).load('user:user-uuid'),
    ).resolves.toEqual([{ productId: '42', quantity: 3 }]);
    expect(cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-uuid' } }),
    );
  });

  it('replaces the stored items inside one transaction', async () => {
    const { prisma, cartItem } = fakePrisma();

    await new PrismaCartStore(prisma as unknown as PrismaService).save('user:user-uuid', [
      { productId: '42', quantity: 2 },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: BigInt(7) } });
    expect(cartItem.createMany).toHaveBeenCalledWith({
      data: [{ cartId: BigInt(7), productId: BigInt(42), quantity: 2 }],
    });
  });

  it('empties the stored cart without inserting rows when saved empty', async () => {
    const { prisma, cartItem } = fakePrisma();

    await new PrismaCartStore(prisma as unknown as PrismaService).save('guest:token-value-1234', []);

    expect(cartItem.deleteMany).toHaveBeenCalled();
    expect(cartItem.createMany).not.toHaveBeenCalled();
  });
});

describe('PrismaProductLookup', () => {
  it('returns null for an id that is not a number, without querying the database', async () => {
    const { prisma, product } = fakePrisma();

    await expect(
      new PrismaProductLookup(prisma as unknown as PrismaService).findById('shoe-1'),
    ).resolves.toBeNull();
    expect(product.findFirst).not.toHaveBeenCalled();
  });

  it('returns the product stock and only active products', async () => {
    const { prisma, product } = fakePrisma();
    product.findFirst.mockResolvedValue({
      id: BigInt(42),
      stockQuantity: 5,
      name: 'Runner',
      price: { toNumber: () => 40.5 },
      imageUrl: null,
    });

    await expect(
      new PrismaProductLookup(prisma as unknown as PrismaService).findById('42'),
    ).resolves.toEqual({
      id: '42',
      stock: 5,
      name: 'Runner',
      price: 40.5,
      imageUrl: null,
    });
    expect(product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(42), isActive: true } }),
    );
  });

  it('returns null when the product does not exist or is inactive', async () => {
    const { prisma, product } = fakePrisma();
    product.findFirst.mockResolvedValue(null);

    await expect(
      new PrismaProductLookup(prisma as unknown as PrismaService).findById('99'),
    ).resolves.toBeNull();
  });
});
