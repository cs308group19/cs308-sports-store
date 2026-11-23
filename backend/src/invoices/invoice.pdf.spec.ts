import { makeInvoiceRecord } from '../../test/helpers/invoice-fixture.js';
import { pdfSafe } from './invoice.format.js';
import { toInvoiceResponse } from './invoice.mapper.js';
import { buildInvoicePdf, invoicePdfFilename } from './invoice.pdf.js';

/**
 * The text drawn on the pages of an uncompressed pdfkit file: the hex strings of its TJ lines,
 * one line of text per row. Built-in fonts use Windows-1252, where 0x95 is the bullet.
 */
function textOf(pdf: Buffer): string {
  return pdf
    .toString('latin1')
    .split('\n')
    .filter((line) => line.endsWith(' TJ'))
    .map((line) =>
      [...line.matchAll(/<([0-9a-f]*)>/gi)]
        .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
        .join('')
        .replaceAll('\u0095', '•'),
    )
    .join('\n');
}

const invoice = () => toInvoiceResponse(makeInvoiceRecord());

/** SCRUM-26. The PDF is built from the same invoice data as the page. */
describe('buildInvoicePdf', () => {
  it('produces a non-empty PDF', async () => {
    const pdf = await buildInvoicePdf(invoice());

    expect(pdf.length).toBeGreaterThan(1500);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-8).toString()).toContain('%%EOF');
  });

  it('puts the invoice number in the file, in its title and on the page', async () => {
    const pdf = await buildInvoicePdf(invoice(), { compress: false });

    expect(pdf.toString('latin1')).toContain('Invoice INV-2026-000007');
    expect(textOf(pdf)).toContain('INV-2026-000007');
  });

  it('draws the blocks of the invoice page', async () => {
    const text = textOf(await buildInvoicePdf(invoice(), { compress: false }));

    for (const expected of [
      'RALLY Sports Ltd.',
      'Tuzla Tax Office',
      'Order RLY-2026-000042',
      'BILLED TO',
      'DELIVER TO',
      'jamie@rally.store',
      '45 Harbour Road',
      'Returns accepted within 30 days of delivery.',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('draws a PAID badge for a paid invoice', async () => {
    const text = textOf(await buildInvoicePdf(invoice(), { compress: false }));

    expect(text.split('\n')).toContain('PAID');
  });

  it('draws the items table with its columns and every line', async () => {
    const text = textOf(await buildInvoicePdf(invoice(), { compress: false }));

    for (const heading of [
      'PRODUCT',
      'MODEL',
      'QTY',
      'LIST PRICE',
      'DISCOUNT',
      'PRICE PAID',
      'LINE TOTAL',
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain('AeroStride Pro');
    expect(text).toContain('AS-PRO-25');
    expect(text).toContain('Court Grip Socks');
    expect(text).toContain('20%');
    expect(text).toContain('$160.00');
  });

  it('draws the same totals as the page and the payment line', async () => {
    const text = textOf(await buildInvoicePdf(invoice(), { compress: false }));

    expect(text).toContain('$259.00'); // subtotal
    expect(text).toContain('-$40.00'); // discounts
    expect(text).toContain('Free'); // delivery
    expect(text).toContain('Tax (8%)');
    expect(text).toContain('$17.52');
    expect(text).toContain('TOTAL PAID');
    expect(text).toContain('$236.52');
    expect(text).toContain('Paid by Visa •••• 4242');
    expect(text).toContain('Ref TXN-8F3A91C2');
  });

  it('never draws a card number or CVV', async () => {
    const text = textOf(await buildInvoicePdf(invoice(), { compress: false }));

    expect(text).not.toMatch(/\d{4} \d{4} \d{4} \d{4}/);
    expect(text).not.toMatch(/cvv/i);
  });

  it('starts a new page when the items do not fit on one', async () => {
    const record = makeInvoiceRecord();
    record.order.items = Array.from({ length: 30 }, (_, i) => ({
      id: BigInt(i + 1),
      productName: `Product ${i + 1}`,
      productModel: `M-${i + 1}`,
      quantity: 1,
      unitListPrice: '10.00',
      discountRate: '0.00',
      unitPricePaid: '10.00',
      lineTotal: '10.00',
    }));
    const pdf = await buildInvoicePdf(toInvoiceResponse(record), {
      compress: false,
    });

    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBe(2);
    const text = textOf(pdf);
    expect(text).toContain('Product 1');
    expect(text).toContain('Product 30');
    expect(text.match(/LINE TOTAL/g)).toHaveLength(2); // the table head repeats
  });

  it('shows no PAID badge when no payment succeeded', async () => {
    const record = makeInvoiceRecord();
    record.order.payments = [];
    const text = textOf(
      await buildInvoicePdf(toInvoiceResponse(record), { compress: false }),
    );

    expect(text.split('\n')).not.toContain('PAID');
    expect(text).not.toContain('Paid by');
  });
});

describe('invoicePdfFilename', () => {
  it('names the file after the invoice number', () => {
    expect(invoicePdfFilename('INV-2026-000007')).toBe('INV-2026-000007.pdf');
  });

  it('keeps anything that could break a header or a path out of the name', () => {
    expect(invoicePdfFilename('a"b/c\r\nd')).toBe('a_b_c__d.pdf');
  });
});

describe('pdfSafe', () => {
  it('keeps what the built-in font can draw, Turkish ü, ö and ç included', () => {
    expect(pdfSafe('Üniversite Çiçek Öner')).toBe('Üniversite Çiçek Öner');
  });

  it('turns the Turkish letters it cannot draw into their plain forms', () => {
    expect(pdfSafe('Yiğit Şahin İstanbul ıspanak')).toBe(
      'Yigit Sahin Istanbul ispanak',
    );
  });

  it('replaces a character it cannot draw at all', () => {
    expect(pdfSafe('Tee 😀')).toBe('Tee ?');
  });
});
