import { BadRequestException } from '@nestjs/common';
import { catalogueId, parseId } from './id.js';

describe('parseId', () => {
  it('parses a positive whole number into a bigint', () => {
    expect(parseId('42')).toBe(42n);
  });

  it.each(['0', '-1', '1.5', 'abc', '', ' 7', '1e3', '0012', '9'.repeat(19)])(
    'rejects %j',
    (raw) => {
      expect(() => parseId(raw, 'product id')).toThrow(BadRequestException);
    },
  );

  it('names the parameter in the error message', () => {
    expect(() => parseId('x', 'order number')).toThrow('Invalid order number.');
  });
});

describe('catalogue IDs in product links', () => {
  it('keeps numeric IDs for existing clients', () => {
    expect(catalogueId(42n)).toBe(42);
  });

  it.each([9007199254740993n, 9223372036854775807n])('round-trips %s through JSON and the detail route', (id) => {
    const value: unknown = JSON.parse(JSON.stringify(catalogueId(id)));
    expect(value).toBe(id.toString());
    expect(parseId(String(value))).toBe(id);
  });
});
