import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  cartOwnerWhere,
  guestOwnerKey,
  parseOwnerKey,
  userOwnerKey,
} from './cart.owner.js';

describe('cart owner keys', () => {
  it('accepts a random UUID as a guest token', () => {
    expect(guestOwnerKey('3f1c2a9e-7b4d-4e8a-9c1f-2d5b6a7e8f90')).toBe(
      'guest:3f1c2a9e-7b4d-4e8a-9c1f-2d5b6a7e8f90',
    );
  });

  it.each([undefined, '', 'short', 'has spaces in it at all', 'x'.repeat(65)])(
    'rejects the guest token %s',
    (token) => {
      expect(() => guestOwnerKey(token)).toThrow(BadRequestException);
    },
  );

  it('keeps guest and user keys apart even for the same text', () => {
    expect(userOwnerKey('abc')).not.toBe(guestOwnerKey('abcdefghijklmnop'));
  });

  it('parses both key kinds back into their parts', () => {
    expect(parseOwnerKey(userOwnerKey('user-uuid'))).toEqual({
      kind: 'user',
      userId: 'user-uuid',
    });
    expect(parseOwnerKey('guest:token-value-1234')).toEqual({
      kind: 'guest',
      token: 'token-value-1234',
    });
  });

  it('maps owner keys to the carts row filter', () => {
    expect(cartOwnerWhere('guest:token-value-1234')).toEqual({
      guestToken: 'token-value-1234',
    });
    expect(cartOwnerWhere(userOwnerKey('user-uuid'))).toEqual({
      userId: 'user-uuid',
    });
  });

  it.each(['guest:', 'user:', 'admin:x', 'nothing'])(
    'rejects the unknown owner key %s',
    (key) => {
      expect(() => cartOwnerWhere(key)).toThrow();
    },
  );
});
