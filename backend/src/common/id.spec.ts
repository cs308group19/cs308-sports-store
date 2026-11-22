import { BadRequestException } from '@nestjs/common';
import { parseId } from './id.js';

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
