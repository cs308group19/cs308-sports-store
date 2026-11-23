import type { InvoiceRecord } from '../../src/invoices/invoice.mapper.js';

type Line = InvoiceRecord['order']['items'][number];

/**
 * An invoice the way checkout saves it (SCRUM-22/23/24): one order with two lines, one succeeded
 * payment and the invoice. List 100.00 and 59.00, 20% off the first: 2 × 80.00 + 59.00 = 219.00,
 * free delivery, tax 8% = 17.52, total 236.52.
 */
export function makeInvoiceRecord(
  overrides: Partial<InvoiceRecord> = {},
  order: Partial<InvoiceRecord['order']> = {},
): InvoiceRecord {
  const items: Line[] = [
    {
      id: 1n,
      productName: 'AeroStride Pro',
      productModel: 'AS-PRO-25',
      quantity: 2,
      unitListPrice: '100.00',
      discountRate: '20.00',
      unitPricePaid: '80.00',
      lineTotal: '160.00',
    },
    {
      id: 2n,
      productName: 'Court Grip Socks',
      productModel: 'CG-03',
      quantity: 1,
      unitListPrice: '59.00',
      discountRate: '0.00',
      unitPricePaid: '59.00',
      lineTotal: '59.00',
    },
  ];
  return {
    id: 7n,
    invoiceNumber: 'INV-2026-000007',
    issuedAt: new Date('2026-11-24T10:30:00Z'),
    billedToName: 'Jamie Taylor',
    billedToAddress: '123 Fast Lane, Istanbul',
    user: { email: 'jamie@rally.store' },
    order: {
      orderNumber: 'RLY-2026-000042',
      status: 'processing',
      taxAmount: '17.52',
      totalAmount: '236.52',
      deliveryRecipient: 'Jamie Taylor',
      deliveryAddress: '45 Harbour Road',
      deliveryCity: 'Istanbul',
      deliveryPostalCode: '34000',
      items,
      payments: [
        {
          status: 'succeeded',
          currency: 'USD',
          cardBrand: 'Visa',
          cardLast4: '4242',
          transactionRef: 'TXN-8F3A91C2',
          processedAt: new Date('2026-11-24T10:29:58Z'),
        },
      ],
      ...order,
    },
    ...overrides,
  };
}
