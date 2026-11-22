/**
 * Prisma returns NUMERIC columns as Decimal objects. The API sends plain numbers rounded to cents,
 * which is what the frontend formats with money().
 */
export type DecimalLike = { toString(): string } | number | string;

export function toNumber(value: DecimalLike): number {
  const parsed = Number(value.toString());
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Not a number: ${value.toString()}`);
  }
  return parsed;
}

export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Price after a percentage discount (0–100), rounded to cents. */
export function applyDiscount(listPrice: number, discountRate: number): number {
  if (discountRate < 0 || discountRate > 100) {
    throw new RangeError('Discount rate must be between 0 and 100.');
  }
  return roundToCents(listPrice * (1 - discountRate / 100));
}
