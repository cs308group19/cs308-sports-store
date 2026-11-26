import { HttpException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../auth/auth.types.js';
import type { InvoicesService } from '../invoices/invoices.service.js';
import { CheckoutController } from './checkout.controller.js';
import type { CheckoutDto } from './checkout.dto.js';
import type { CheckoutService } from './checkout.service.js';

/**
 * SCRUM-62 (regression tests for checkout). The mock bank decides before anything is written: a
 * declined card answers 402 without calling the order service, and an approved card passes only
 * the brand and last four digits on.
 */

const checkout = { placeOrder: vi.fn() };
const invoices = { sendInvoiceEmail: vi.fn() };
const controller = new CheckoutController(
  checkout as unknown as CheckoutService,
  invoices as unknown as InvoicesService,
);

const user = { id: '11111111-1111-4111-8111-111111111111' } as AuthUser;
const ORDER = { orderId: '7', orderNumber: 'RLY-ABC', invoiceId: '9' };

/** The body after CheckoutDto has removed the spaces from the card number. */
const body = (cardNumber = '4242424242424242'): CheckoutDto => ({
  deliveryRecipient: 'Deniz Yılmaz',
  deliveryAddress: '123 Fast Lane, Istanbul',
  cardholderName: 'Deniz Yılmaz',
  cardNumber,
  expiry: '12/30',
  cvv: '9731',
  reviewedCart: {
    items: [{ productId: '2', quantity: 1, lineTotalCents: 1_200 }],
    totalCents: 2_096,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  checkout.placeOrder.mockResolvedValue(ORDER);
  invoices.sendInvoiceEmail.mockResolvedValue(undefined);
});

describe('CheckoutController.placeOrder, declined payment', () => {
  it.each([
    ['the demo decline card', '4000000000000002'],
    ['another valid card number', '4012888888881881'],
  ])('answers 402 for %s and writes nothing', async (_case, cardNumber) => {
    const error = await controller
      .placeOrder(user, body(cardNumber))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.PAYMENT_REQUIRED,
    );
    expect((error as HttpException).getResponse()).toEqual({
      statusCode: 402,
      message: 'Payment was declined.',
      error: 'Payment Required',
    });
    expect(checkout.placeOrder).not.toHaveBeenCalled();
    expect(invoices.sendInvoiceEmail).not.toHaveBeenCalled();
  });
});

describe('CheckoutController.placeOrder, approved payment', () => {
  it('places the order with the delivery details and only the card brand and last four digits', async () => {
    await controller.placeOrder(user, body());

    expect(checkout.placeOrder).toHaveBeenCalledWith(
      user.id,
      {
        deliveryRecipient: 'Deniz Yılmaz',
        deliveryAddress: '123 Fast Lane, Istanbul',
      },
      { cardBrand: 'Visa', cardLast4: '4242' },
      body().reviewedCart,
    );
    const passedOn = JSON.stringify(checkout.placeOrder.mock.calls);
    expect(passedOn).not.toContain('4242424242424242');
    expect(passedOn).not.toContain('9731');
  });

  it('returns the order ids and sends the invoice email for that invoice', async () => {
    await expect(controller.placeOrder(user, body())).resolves.toEqual(ORDER);

    expect(invoices.sendInvoiceEmail).toHaveBeenCalledWith('9');
  });

  it('answers without waiting for the invoice email', async () => {
    invoices.sendInvoiceEmail.mockReturnValue(new Promise(() => {}));

    await expect(controller.placeOrder(user, body())).resolves.toEqual(ORDER);
  });

  it('does not send an invoice email when the order is refused', async () => {
    checkout.placeOrder.mockRejectedValue(new Error('stock'));

    await expect(controller.placeOrder(user, body())).rejects.toThrow('stock');

    expect(invoices.sendInvoiceEmail).not.toHaveBeenCalled();
  });
});
