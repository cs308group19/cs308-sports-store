import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { isCardExpiry, isCardNumber } from './card-validation.js';
import { CheckoutDto } from './checkout.dto.js';
import { authorizeMockPayment } from './mock-bank.js';

const input = {
  deliveryRecipient: 'Deniz Yılmaz',
  deliveryAddress: 'Test address, Istanbul',
  cardholderName: 'Deniz Yılmaz',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/99',
  cvv: '9731',
  reviewedCart: {
    items: [{ productId: '10', quantity: 1, lineTotalCents: 2000 }],
    totalCents: 2960,
  },
};

describe('checkout card validation', () => {
  it('normalizes the card before checking its checksum and supports Unicode names', () => {
    const dto = plainToInstance(CheckoutDto, input);
    expect(validateSync(dto)).toEqual([]);
    expect(dto.cardNumber).toBe('4242424242424242');
  });

  it.each([
    ['cardholderName', '1234'],
    ['cardNumber', '4242 4242 4242 4243'],
    ['cardNumber', 4242424242424242],
    ['expiry', '13/99'],
    ['expiry', '01/00'],
    ['cvv', '12345'],
    ['cvv', 9731],
  ])('rejects an invalid %s', (field, value) => {
    const dto = plainToInstance(CheckoutDto, { ...input, [field]: value });
    expect(validateSync(dto).map((error) => error.property)).toEqual([field]);
  });

  it('accepts the current month and changes month at midnight Istanbul time', () => {
    expect(isCardExpiry('12/26', new Date('2026-12-31T20:59:59Z'))).toBe(true);
    expect(isCardExpiry('12/26', new Date('2026-12-31T21:00:00Z'))).toBe(false);
    expect(isCardExpiry('01/27', new Date('2026-12-31T21:00:00Z'))).toBe(true);
  });

  it('approves only the configured demo card and exposes only its brand and last four digits', () => {
    expect(authorizeMockPayment('4242424242424242')).toEqual({
      cardBrand: 'Visa',
      cardLast4: '4242',
    });
    for (const declined of ['4000000000000002', '4012888888881881']) {
      expect(isCardNumber(declined)).toBe(true);
      expect(authorizeMockPayment(declined)).toBeNull();
    }
  });
});
