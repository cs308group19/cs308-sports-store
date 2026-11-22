import { BadRequestException } from '@nestjs/common';

/** Database ids are BIGINT identity columns. Rejects anything that is not a positive whole number. */
export function parseId(raw: string, what = 'id'): bigint {
  if (!/^[1-9]\d{0,17}$/.test(raw)) {
    throw new BadRequestException(`Invalid ${what}.`);
  }
  return BigInt(raw);
}
