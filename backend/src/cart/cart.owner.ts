import { BadRequestException } from '@nestjs/common';

/** Guest tokens are random UUIDs created by the browser. Anything else is rejected. */
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export const GUEST_TOKEN_HEADER = 'x-cart-token';

export type CartOwner = { kind: 'user'; userId: string } | { kind: 'guest'; token: string };

/** Owner key used by CartService. Users and guests never share a key. */
export function userOwnerKey(userId: string): string {
  return `user:${userId}`;
}

export function guestOwnerKey(token: string | undefined): string {
  if (!token || !GUEST_TOKEN_PATTERN.test(token)) {
    throw new BadRequestException(`A valid ${GUEST_TOKEN_HEADER} header is required.`);
  }
  return `guest:${token}`;
}

export function parseOwnerKey(key: string): CartOwner {
  const separator = key.indexOf(':');
  const kind = key.slice(0, separator);
  const value = key.slice(separator + 1);
  if (kind === 'user' && value) return { kind: 'user', userId: value };
  if (kind === 'guest' && value) return { kind: 'guest', token: value };
  throw new Error(`Unknown cart owner key: ${key}`);
}
