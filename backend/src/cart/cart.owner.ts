import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/** The browser keeps a random guest cart id and sends it with every cart request. */
export const CART_TOKEN_HEADER = 'x-cart-token';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Owner keys tell the cart store whose cart it is: "guest:<token>" for a visitor, or
 * "user:<profile id>" for a signed-in customer (used when the guest cart moves over, SCRUM-17).
 */
export function guestOwnerKey(token: string): string {
  return `guest:${token.toLowerCase()}`;
}

export function userOwnerKey(userId: string): string {
  return `user:${userId}`;
}

/** The `carts` row filter for an owner key. */
export function cartOwnerWhere(
  ownerKey: string,
): { guestToken: string } | { userId: string } {
  const [kind, ...rest] = ownerKey.split(':');
  const value = rest.join(':');
  if (kind === 'guest' && value) return { guestToken: value };
  if (kind === 'user' && value) return { userId: value };
  throw new BadRequestException('Unknown cart owner.');
}

/** Rejects anything that is not the random UUID the frontend generates. */
export function parseGuestToken(raw: unknown): string {
  if (typeof raw !== 'string' || !UUID_PATTERN.test(raw)) {
    throw new BadRequestException(
      `Missing or invalid ${CART_TOKEN_HEADER} header.`,
    );
  }
  return raw;
}

/** Injects the owner key of the guest cart named in the X-Cart-Token header. */
export const CartOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    return guestOwnerKey(parseGuestToken(request.headers[CART_TOKEN_HEADER]));
  },
);
