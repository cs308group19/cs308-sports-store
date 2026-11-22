import { applyDiscount, roundToCents, toNumber } from './money.js';

describe('money helpers', () => {
  it('reads Prisma Decimal-like values, strings and numbers', () => {
    expect(toNumber({ toString: () => '129.90' })).toBe(129.9);
    expect(toNumber('42')).toBe(42);
    expect(toNumber(7.5)).toBe(7.5);
  });

  it('refuses a value that is not a number', () => {
    expect(() => toNumber('abc')).toThrow(TypeError);
  });

  it('rounds to cents without floating point drift', () => {
    expect(roundToCents(1.005)).toBe(1.01);
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
  });

  it('applies a percentage discount', () => {
    expect(applyDiscount(159, 0)).toBe(159);
    expect(applyDiscount(159, 20)).toBe(127.2);
    expect(applyDiscount(99.99, 15)).toBe(84.99);
    expect(applyDiscount(50, 100)).toBe(0);
  });

  it('rejects a discount outside 0–100', () => {
    expect(() => applyDiscount(10, -1)).toThrow(RangeError);
    expect(() => applyDiscount(10, 101)).toThrow(RangeError);
  });
});
