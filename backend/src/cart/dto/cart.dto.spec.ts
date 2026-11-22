import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddCartItemDto, UpdateCartQuantityDto } from './cart.dto.js';

/** SCRUM-62. Request bodies of the cart endpoints, checked the way the global ValidationPipe does. */
async function errorsFor<T extends object>(
  dto: new () => T,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(dto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('AddCartItemDto', () => {
  it('accepts a product id alone (quantity defaults to 1 in the service)', async () => {
    expect(await errorsFor(AddCartItemDto, { productId: 3 })).toEqual([]);
  });

  it('accepts a product id with a quantity', async () => {
    expect(
      await errorsFor(AddCartItemDto, { productId: 3, quantity: 2 }),
    ).toEqual([]);
  });

  it.each([undefined, 0, -1, 1.5, '3', null])(
    'rejects the product id %j',
    async (productId) => {
      expect(await errorsFor(AddCartItemDto, { productId })).toContain(
        'productId',
      );
    },
  );

  it.each([1.5, '2', true])('rejects the quantity %j', async (quantity) => {
    expect(
      await errorsFor(AddCartItemDto, { productId: 3, quantity }),
    ).toContain('quantity');
  });

  it('treats a null quantity as not given, so the service adds one', async () => {
    expect(
      await errorsFor(AddCartItemDto, { productId: 3, quantity: null }),
    ).toEqual([]);
  });

  it('rejects fields the endpoint does not take, such as a price', async () => {
    expect(
      await errorsFor(AddCartItemDto, { productId: 3, price: 0.01 }),
    ).toContain('price');
  });
});

describe('UpdateCartQuantityDto', () => {
  it('accepts a whole-number quantity', async () => {
    expect(await errorsFor(UpdateCartQuantityDto, { quantity: 4 })).toEqual([]);
  });

  it.each([undefined, 2.5, '4', null])(
    'rejects the quantity %j',
    async (quantity) => {
      expect(await errorsFor(UpdateCartQuantityDto, { quantity })).toContain(
        'quantity',
      );
    },
  );

  it('rejects a product id in the body (it belongs in the path)', async () => {
    expect(
      await errorsFor(UpdateCartQuantityDto, { quantity: 1, productId: 9 }),
    ).toContain('productId');
  });
});
