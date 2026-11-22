import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AddCartItemDto, UpdateCartQuantityDto } from './cart.dto.js';

async function errorsOf<T extends object>(cls: new () => T, data: object) {
  return validate(plainToInstance(cls, data));
}

describe('AddCartItemDto', () => {
  it('accepts a numeric product id without a quantity', async () => {
    await expect(errorsOf(AddCartItemDto, { productId: '42' })).resolves.toEqual([]);
  });

  it.each([{ productId: 'shoe-1' }, { productId: 42 }, { productId: '' }])(
    'rejects the body %o',
    async (body) => {
      expect((await errorsOf(AddCartItemDto, body)).length).toBeGreaterThan(0);
    },
  );

  it.each([0, -1, 100, 1.5])('rejects the quantity %s', async (quantity) => {
    expect(
      (await errorsOf(AddCartItemDto, { productId: '42', quantity })).length,
    ).toBeGreaterThan(0);
  });
});

describe('UpdateCartQuantityDto', () => {
  it('accepts a quantity from 1 to 99', async () => {
    await expect(errorsOf(UpdateCartQuantityDto, { quantity: 99 })).resolves.toEqual([]);
  });

  it('rejects a missing quantity', async () => {
    expect((await errorsOf(UpdateCartQuantityDto, {})).length).toBeGreaterThan(0);
  });
});
