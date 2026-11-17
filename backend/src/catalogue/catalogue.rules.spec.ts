import { describe, expect, it } from 'vitest';
import {
  isDuplicateCategory,
  isInStock,
  isValidPrice,
  isValidStock,
  normalizeCategoryName,
  type ProductInput,
  validateCategoryName,
  validateProduct,
} from './catalogue.rules.js';

const validProduct: ProductInput = {
  name: 'Match Pro Football',
  model: 'MPF-2026',
  serialNumber: 'SN-000123',
  description: 'Official size 5 match ball.',
  stock: 12,
  price: 42,
  warrantyStatus: '2 years',
  distributor: 'Rally Sports Ltd.',
};

describe('validateProduct', () => {
  it('accepts a complete product', () => {
    expect(validateProduct(validProduct)).toEqual([]);
  });

  it.each([
    ['name', 'Name'],
    ['model', 'Model'],
    ['serialNumber', 'Serial number'],
    ['description', 'Description'],
    ['warrantyStatus', 'Warranty status'],
    ['distributor', 'Distributor'],
  ] as const)('requires %s', (field, label) => {
    expect(validateProduct({ ...validProduct, [field]: '   ' })).toContain(
      `${label} is required.`,
    );
  });

  it('reports a missing required field', () => {
    const { name: _name, ...withoutName } = validProduct;
    expect(validateProduct(withoutName)).toContain('Name is required.');
  });

  it('rejects a negative price', () => {
    expect(validateProduct({ ...validProduct, price: -1 })).toContain(
      'Price must be a number with at most two decimals and no negative value.',
    );
  });

  it('rejects a price with more than two decimals', () => {
    expect(validateProduct({ ...validProduct, price: 10.999 })).not.toEqual([]);
  });

  it('rejects a fractional stock quantity', () => {
    expect(validateProduct({ ...validProduct, stock: 2.5 })).toContain(
      'Stock must be a whole number, zero or more.',
    );
  });
});

describe('price and stock rules', () => {
  it.each([0, 0.01, 19.99, 1000])('accepts the price %s', (price) => {
    expect(isValidPrice(price)).toBe(true);
  });

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY, '42'])(
    'rejects the price %s',
    (price) => {
      expect(isValidPrice(price)).toBe(false);
    },
  );

  it('accepts zero stock and rejects negative stock', () => {
    expect(isValidStock(0)).toBe(true);
    expect(isValidStock(-1)).toBe(false);
  });

  it('treats zero stock as out of stock', () => {
    expect(isInStock(0)).toBe(false);
    expect(isInStock(1)).toBe(true);
  });
});

describe('category names', () => {
  it('collapses spaces and trims the name', () => {
    expect(normalizeCategoryName('  Gym    Gear ')).toBe('Gym Gear');
  });

  it('rejects names that are too short or too long', () => {
    expect(validateCategoryName('A')).not.toBeNull();
    expect(validateCategoryName('x'.repeat(51))).not.toBeNull();
    expect(validateCategoryName('Football')).toBeNull();
  });

  it('detects duplicate names regardless of case and extra spaces', () => {
    expect(isDuplicateCategory(['Football', 'Running'], 'football')).toBe(true);
    expect(isDuplicateCategory(['Football'], '  FOOTBALL ')).toBe(true);
    expect(isDuplicateCategory(['Football'], 'Fitness')).toBe(false);
  });
});
