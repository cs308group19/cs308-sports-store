import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { InMemoryCartStore } from './cart.store.memory.js';
import { CartService } from './cart.service.js';
import type { ProductLookup, ProductSnapshot } from './cart.types.js';

class FakeProducts implements ProductLookup {
  constructor(private readonly items: ProductSnapshot[]) {}

  async findById(productId: string): Promise<ProductSnapshot | null> {
    return this.items.find((item) => item.id === productId) ?? null;
  }
}

const setup = (products: ProductSnapshot[] = []) => {
  const store = new InMemoryCartStore();
  const service = new CartService(store, new FakeProducts(products));
  return { store, service };
};

const SHOE = { id: 'shoe-1', stock: 5 };
const BALL = { id: 'ball-1', stock: 0 };

describe('CartService.addItem', () => {
  it('adds a product with quantity 1 by default', async () => {
    const { service } = setup([SHOE]);

    await expect(service.addItem('guest-a', 'shoe-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 1 },
    ]);
  });

  it('merges quantities when the same product is added again', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 2);
    const cart = await service.addItem('guest-a', 'shoe-1', 1);

    expect(cart).toEqual([{ productId: 'shoe-1', quantity: 3 }]);
  });

  it('rejects a product that does not exist', async () => {
    const { service } = setup([SHOE]);

    await expect(service.addItem('guest-a', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a product that is out of stock', async () => {
    const { service } = setup([BALL]);

    await expect(service.addItem('guest-a', 'ball-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a quantity that would exceed the stock', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 4);

    await expect(service.addItem('guest-a', 'shoe-1', 2)).rejects.toThrow(
      'Only 5 left in stock.',
    );
  });

  it.each([0, -1, 1.5, 100, Number.NaN])(
    'rejects the invalid quantity %s',
    async (quantity) => {
      const { service } = setup([SHOE]);

      await expect(
        service.addItem('guest-a', 'shoe-1', quantity),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('leaves the stored cart unchanged when an add fails', async () => {
    const { service, store } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 1);
    await expect(service.addItem('guest-a', 'shoe-1', 10)).rejects.toThrow();

    await expect(store.load('guest-a')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 1 },
    ]);
  });

  it('keeps guest and user carts separate', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 2);

    await expect(service.getCart('user-1')).resolves.toEqual([]);
  });

  it('rejects an empty cart owner', async () => {
    const { service } = setup([SHOE]);

    await expect(service.addItem('   ', 'shoe-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('CartService.removeItem', () => {
  it('removes the product and keeps the other items', async () => {
    const { service } = setup([SHOE, { id: 'cap-1', stock: 3 }]);

    await service.addItem('guest-a', 'shoe-1');
    await service.addItem('guest-a', 'cap-1');

    await expect(service.removeItem('guest-a', 'shoe-1')).resolves.toEqual([
      { productId: 'cap-1', quantity: 1 },
    ]);
  });

  it('throws when the product is not in the cart', async () => {
    const { service } = setup([SHOE]);

    await expect(service.removeItem('guest-a', 'shoe-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not touch another owner’s cart', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('user-1', 'shoe-1');

    await expect(service.removeItem('guest-a', 'shoe-1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getCart('user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 1 },
    ]);
  });
});
