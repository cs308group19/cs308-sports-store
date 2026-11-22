import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  cartOwnerWhere,
  guestOwnerKey,
  parseGuestToken,
  userOwnerKey,
} from './cart.owner.js';

const TOKEN = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

describe('parseGuestToken', () => {
  it('accepts a random UUID', () => {
    expect(parseGuestToken(TOKEN)).toBe(TOKEN);
  });

  it.each([undefined, '', 'guest-a', '1234', `${TOKEN}x`, ['a', 'b']])(
    'rejects %s',
    (raw) => {
      expect(() => parseGuestToken(raw)).toThrow(BadRequestException);
    },
  );
});

describe('cart owner keys', () => {
  it('maps a guest token to the guest_token column, ignoring letter case', () => {
    expect(cartOwnerWhere(guestOwnerKey(TOKEN.toUpperCase()))).toEqual({
      guestToken: TOKEN,
    });
  });

  it('maps a signed-in user to the user_id column', () => {
    expect(cartOwnerWhere(userOwnerKey('user-1'))).toEqual({
      userId: 'user-1',
    });
  });

  it.each(['guest:', 'user:', 'admin:x', 'nothing'])(
    'rejects the malformed key %s',
    (key) => {
      expect(() => cartOwnerWhere(key)).toThrow(BadRequestException);
    },
  );
});
