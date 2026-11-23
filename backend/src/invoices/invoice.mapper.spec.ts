import { makeInvoiceRecord } from '../../test/helpers/invoice-fixture.js';
import { toInvoiceResponse } from './invoice.mapper.js';

/** SCRUM-25. The amounts on an invoice come from the saved order, not from a recalculation. */
describe('toInvoiceResponse', () => {
  it('maps the invoice, order, customer and payment fields', () => {
    const invoice = toInvoiceResponse(makeInvoiceRecord());
    expect(invoice).toMatchObject({
      id: '7',
      invoiceNumber: 'INV-2026-000007',
      issuedAt: '2026-11-24T10:30:00.000Z',
      orderNumber: 'RLY-2026-000042',
      status: 'processing',
      paid: true,
      currency: 'USD',
      billedTo: {
        name: 'Jamie Taylor',
        email: 'jamie@rally.store',
        address: '123 Fast Lane, Istanbul',
      },
      deliverTo: {
        recipient: 'Jamie Taylor',
        address: '45 Harbour Road',
        city: 'Istanbul',
        postalCode: '34000',
      },
      payment: {
        cardBrand: 'Visa',
        cardLast4: '4242',
        transactionRef: 'TXN-8F3A91C2',
        processedAt: '2026-11-24T10:29:58.000Z',
      },
    });
    expect(invoice.seller.name).toBe('RALLY Sports Ltd.');
  });

  it('lists each line with its list price, discount, price paid and line total', () => {
    const { items } = toInvoiceResponse(makeInvoiceRecord());
    expect(items).toEqual([
      {
        name: 'AeroStride Pro',
        model: 'AS-PRO-25',
        quantity: 2,
        unitListPrice: 100,
        discountRate: 20,
        unitPricePaid: 80,
        lineTotal: 160,
      },
      {
        name: 'Court Grip Socks',
        model: 'CG-03',
        quantity: 1,
        unitListPrice: 59,
        discountRate: 0,
        unitPricePaid: 59,
        lineTotal: 59,
      },
    ]);
  });

  it('shows the list subtotal and the discounts so that the totals add up', () => {
    const invoice = toInvoiceResponse(makeInvoiceRecord());
    expect(invoice.subtotal).toBe(259);
    expect(invoice.discountTotal).toBe(40);
    expect(invoice.deliveryFee).toBe(0);
    expect(invoice.tax).toBe(17.52);
    expect(invoice.total).toBe(236.52);
    expect(
      Math.round(
        (invoice.subtotal -
          invoice.discountTotal +
          invoice.deliveryFee +
          invoice.tax) *
          100,
      ) / 100,
    ).toBe(invoice.total);
  });

  it('charges no delivery fee on a discounted order that still pays nothing for delivery', () => {
    // The lines already carry their discounts. Adding the discounts back would invent a fee of 40.
    expect(toInvoiceResponse(makeInvoiceRecord()).deliveryFee).toBe(0);
  });

  it('works out the delivery fee of 8 on an order under 75 when there is no fee column', () => {
    const invoice = toInvoiceResponse(
      makeInvoiceRecord(
        {},
        {
          items: [
            {
              id: 1n,
              productName: 'Grip Tape',
              productModel: null,
              quantity: 1,
              unitListPrice: '40.00',
              discountRate: '0.00',
              unitPricePaid: '40.00',
              lineTotal: '40.00',
            },
          ],
          taxAmount: '3.20',
          totalAmount: '51.20',
        },
      ),
    );
    expect(invoice.deliveryFee).toBe(8);
    expect(invoice.discountTotal).toBe(0);
    expect(invoice.items[0].model).toBeNull();
  });

  it('uses the saved delivery fee when the order has one', () => {
    const invoice = toInvoiceResponse(
      makeInvoiceRecord({}, { deliveryFee: '5.00' }),
    );
    expect(invoice.deliveryFee).toBe(5);
  });

  it('reads the saved delivery fee from the invoice row when the order has none', () => {
    const invoice = toInvoiceResponse(
      makeInvoiceRecord({ deliveryFee: '8.00' }),
    );
    expect(invoice.deliveryFee).toBe(8);
  });

  it('never shows a negative delivery fee', () => {
    const invoice = toInvoiceResponse(
      makeInvoiceRecord({}, { totalAmount: '200.00' }),
    );
    expect(invoice.deliveryFee).toBe(0);
  });

  it('adds up in whole cents', () => {
    // 3 × 0.10 and 3 × 0.20 would give 0.30000000000000004 and 0.6000000000000001 as floats.
    const invoice = toInvoiceResponse(
      makeInvoiceRecord(
        {},
        {
          items: [
            {
              id: 1n,
              productName: 'A',
              productModel: null,
              quantity: 3,
              unitListPrice: '0.10',
              discountRate: '0.00',
              unitPricePaid: '0.10',
              lineTotal: '0.30',
            },
            {
              id: 2n,
              productName: 'B',
              productModel: null,
              quantity: 3,
              unitListPrice: '0.20',
              discountRate: '0.00',
              unitPricePaid: '0.20',
              lineTotal: '0.60',
            },
          ],
          taxAmount: '0.07',
          totalAmount: '8.97',
        },
      ),
    );
    expect(invoice.subtotal).toBe(0.9);
    expect(invoice.deliveryFee).toBe(8);
    expect(invoice.total).toBe(8.97);
  });

  it('keeps cents on a 15% discount that does not divide evenly', () => {
    const invoice = toInvoiceResponse(
      makeInvoiceRecord(
        {},
        {
          items: [
            {
              id: 1n,
              productName: 'Cap',
              productModel: 'C-1',
              quantity: 3,
              unitListPrice: '19.99',
              discountRate: '15.00',
              unitPricePaid: '16.99',
              lineTotal: '50.97',
            },
          ],
          taxAmount: '4.08',
          totalAmount: '63.05',
        },
      ),
    );
    expect(invoice.subtotal).toBe(59.97);
    expect(invoice.discountTotal).toBe(9);
    expect(invoice.deliveryFee).toBe(8);
  });

  it('puts the payment in the answer only when it succeeded', () => {
    const failedOnly = toInvoiceResponse(
      makeInvoiceRecord(
        {},
        {
          payments: [
            {
              status: 'failed',
              currency: 'USD',
              cardBrand: 'Visa',
              cardLast4: '0002',
              transactionRef: null,
              processedAt: null,
            },
          ],
        },
      ),
    );
    expect(failedOnly.paid).toBe(false);
    expect(failedOnly.payment).toBeNull();
  });

  it('exposes only the last four digits of the card', () => {
    const json = JSON.stringify(toInvoiceResponse(makeInvoiceRecord()));
    expect(json).toContain('"cardLast4":"4242"');
    expect(json).not.toMatch(/cvv|cardNumber/i);
  });

  it('orders the lines by their id', () => {
    const record = makeInvoiceRecord();
    record.order.items.reverse();
    expect(toInvoiceResponse(record).items.map((i) => i.name)).toEqual([
      'AeroStride Pro',
      'Court Grip Socks',
    ]);
  });
});
