import { BadRequestException } from '@nestjs/common';

/** Largest value of a PostgreSQL BIGINT. */
const MAX_BIGINT = 9223372036854775807n;

/** True for a positive whole number that fits a BIGINT identity column. */
export function isDatabaseId(raw: string): boolean {
  return /^[1-9]\d{0,18}$/.test(raw) && BigInt(raw) <= MAX_BIGINT;
}

/** Database ids are BIGINT identity columns. Rejects anything that is not a positive whole number. */
export function parseId(raw: string, what = 'id'): bigint {
  if (!isDatabaseId(raw)) {
    throw new BadRequestException(`Invalid ${what}.`);
  }
  return BigInt(raw);
}

/** Keep the existing numeric API for small IDs and preserve larger BIGINTs exactly in JSON. */
export function catalogueId(id: bigint): number | string {
  return id <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(id) : id.toString();
}
