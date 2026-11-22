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

const SHOE = { id: 'shoe-1', stock: 5, name: 'Item', price: 10, imageUrl: null };
const BALL = { id: 'ball-1', stock: 0, name: 'Item', price: 10, imageUrl: null };

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
    const { service } = setup([SHOE, { id: 'cap-1', stock: 3, name: 'Item', price: 10, imageUrl: null }]);

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

describe('CartService.updateQuantity', () => {
  it('changes the quantity of an item in the cart', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 1);
    await expect(
      service.updateQuantity('guest-a', 'shoe-1', 4),
    ).resolves.toEqual([{ productId: 'shoe-1', quantity: 4 }]);
  });

  it('allows setting the quantity up to the stock limit', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 1);
    await expect(
      service.updateQuantity('guest-a', 'shoe-1', 5),
    ).resolves.toEqual([{ productId: 'shoe-1', quantity: 5 }]);
  });

  it('rejects a quantity above the stock and keeps the old quantity', async () => {
    const { service, store } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 2);
    await expect(
      service.updateQuantity('guest-a', 'shoe-1', 6),
    ).rejects.toThrow('Only 5 left in stock.');

    await expect(store.load('guest-a')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 2 },
    ]);
  });

  it.each([0, -1, 1.5, 100, Number.NaN])(
    'rejects the invalid quantity %s',
    async (quantity) => {
      const { service } = setup([SHOE]);

      await service.addItem('guest-a', 'shoe-1', 1);
      await expect(
        service.updateQuantity('guest-a', 'shoe-1', quantity),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects an item that is not in the cart', async () => {
    const { service } = setup([SHOE]);

    await expect(
      service.updateQuantity('guest-a', 'shoe-1', 2),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a product that does not exist', async () => {
    const { service } = setup([SHOE]);

    await expect(
      service.updateQuantity('guest-a', 'missing', 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not change another owner’s cart', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('user-1', 'shoe-1', 1);
    await expect(
      service.updateQuantity('guest-a', 'shoe-1', 2),
    ).rejects.toThrow(NotFoundException);

    await expect(service.getCart('user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 1 },
    ]);
  });
});

describe('CartService.mergeGuestCart', () => {
  it('adds quantities when the same product is in both carts', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('user-1', 'shoe-1', 1);
    await service.addItem('guest-a', 'shoe-1', 2);

    await expect(service.mergeGuestCart('guest-a', 'user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 3 },
    ]);
  });

  it('caps the merged quantity at the stock', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('user-1', 'shoe-1', 3);
    await service.addItem('guest-a', 'shoe-1', 2);

    await expect(service.mergeGuestCart('guest-a', 'user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 5 },
    ]);
  });

  it('moves guest items into an empty customer cart', async () => {
    const { service } = setup([SHOE, { id: 'cap-1', stock: 3, name: 'Item', price: 10, imageUrl: null }]);

    await service.addItem('guest-a', 'shoe-1', 1);
    await service.addItem('guest-a', 'cap-1', 2);

    await expect(service.mergeGuestCart('guest-a', 'user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 1 },
      { productId: 'cap-1', quantity: 2 },
    ]);
  });

  it('empties the guest cart after the merge', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 2);
    await service.mergeGuestCart('guest-a', 'user-1');

    await expect(service.getCart('guest-a')).resolves.toEqual([]);
  });

  it('keeps the customer cart unchanged when the guest cart is empty', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('user-1', 'shoe-1', 2);

    await expect(service.mergeGuestCart('guest-a', 'user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 2 },
    ]);
  });

  it('drops guest items whose product is out of stock or deleted', async () => {
    const { service, store } = setup([SHOE]);

    await service.addItem('guest-a', 'shoe-1', 2);
    await store.save('guest-a', [
      { productId: 'shoe-1', quantity: 2 },
      { productId: 'gone-1', quantity: 1 },
    ]);

    await expect(service.mergeGuestCart('guest-a', 'user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 2 },
    ]);
  });

  it('does nothing when the guest and customer keys are the same', async () => {
    const { service } = setup([SHOE]);

    await service.addItem('user-1', 'shoe-1', 2);

    await expect(service.mergeGuestCart('user-1', 'user-1')).resolves.toEqual([
      { productId: 'shoe-1', quantity: 2 },
    ]);
  });
});

describe('CartService.view', () => {
  it('returns product details, line totals and the cart total', async () => {
    const { service } = setup([
      { id: 'shoe-1', stock: 5, name: 'Runner', price: 40.5, imageUrl: 'shoe.png' },
      { id: 'cap-1', stock: 3, name: 'Cap', price: 12, imageUrl: null },
    ]);

    await service.addItem('guest-a', 'shoe-1', 2);
    await service.addItem('guest-a', 'cap-1', 1);

    await expect(service.view('guest-a')).resolves.toEqual({
      items: [
        {
          productId: 'shoe-1',
          name: 'Runner',
          price: 40.5,
          imageUrl: 'shoe.png',
          stock: 5,
          quantity: 2,
          lineTotal: 81,
        },
        {
          productId: 'cap-1',
          name: 'Cap',
          price: 12,
          imageUrl: null,
          stock: 3,
          quantity: 1,
          lineTotal: 12,
        },
      ],
      total: 93,
    });
  });

  it('leaves out lines whose product no longer exists', async () => {
    const { service, store } = setup([SHOE]);

    await store.save('guest-a', [
      { productId: 'shoe-1', quantity: 1 },
      { productId: 'gone-1', quantity: 4 },
    ]);

    const view = await service.view('guest-a');
    expect(view.items.map((item) => item.productId)).toEqual(['shoe-1']);
  });

  it('returns an empty cart with total zero', async () => {
    const { service } = setup([SHOE]);

    await expect(service.view('guest-a')).resolves.toEqual({ items: [], total: 0 });
  });
});
