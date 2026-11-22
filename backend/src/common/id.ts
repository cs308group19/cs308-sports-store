import { BadRequestException } from '@nestjs/common';

/** Database ids are BIGINT identity columns. Rejects anything that is not a positive whole number. */
export function parseId(raw: string, what = 'id'): bigint {
  if (!/^[1-9]\d{0,18}$/.test(raw) || BigInt(raw) > 9223372036854775807n) {
    throw new BadRequestException(`Invalid ${what}.`);
  }
  return BigInt(raw);
}

/** Keep the existing numeric API for small IDs and preserve larger BIGINTs exactly in JSON. */
export function catalogueId(id: bigint): number | string {
  return id <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(id) : id.toString();
}
