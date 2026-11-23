import PDFDocument from 'pdfkit';
import {
  addressLines,
  formatAmount,
  formatDiscount,
  formatInvoiceDate,
  pdfSafe,
} from './invoice.format.js';
import type { InvoiceResponse } from './invoice.types.js';

const NAVY = '#071a33';
const ORANGE = '#f45b23';
const MUTED = '#687486';
const LINE = '#e3e8ee';
const GREEN = '#16825d';
const GREEN_BG = '#e5f5ef';
const HEAD_BG = '#f1f3f5';

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
/** Content stops here; below it a new page starts. */
const PAGE_BOTTOM = PAGE_HEIGHT - 50;

/** The table columns of the page: #, Product, Model, Qty, List price, Discount, Price paid, Line total. */
const COLUMNS = [
  { title: '#', width: 22, align: 'left' },
  { title: 'PRODUCT', width: 140, align: 'left' },
  { title: 'MODEL', width: 85, align: 'left' },
  { title: 'QTY', width: 30, align: 'right' },
  { title: 'LIST PRICE', width: 70, align: 'right' },
  { title: 'DISCOUNT', width: 52, align: 'right' },
  { title: 'PRICE PAID', width: 58, align: 'right' },
  { title: 'LINE TOTAL', width: 58, align: 'right' },
] as const;

export interface BuildInvoicePdfOptions {
  /** On by default. Tests turn it off to read the text inside the file. */
  compress?: boolean;
}

/**
 * SCRUM-26. Draws the invoice with the same blocks, in the same order, as the invoice page
 * (frontend/src/pages/customer/Invoice.tsx), from the same InvoiceResponse.
 */
export function buildInvoicePdf(
  invoice: InvoiceResponse,
  options: BuildInvoicePdfOptions = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 0 },
    compress: options.compress ?? true,
    info: {
      Title: `Invoice ${invoice.invoiceNumber}`,
      Author: invoice.seller.name,
      Subject: `Order ${invoice.orderNumber}`,
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const money = (value: number) => formatAmount(value, invoice.currency);
  const text = (
    value: string,
    x: number,
    y: number,
    style: {
      font?: 'Helvetica' | 'Helvetica-Bold';
      size?: number;
      color?: string;
      width?: number;
      align?: 'left' | 'right' | 'center';
    } = {},
  ) => {
    doc
      .font(style.font ?? 'Helvetica')
      .fontSize(style.size ?? 9)
      .fillColor(style.color ?? NAVY)
      .text(pdfSafe(value), x, y, {
        width: style.width ?? CONTENT_WIDTH,
        align: style.align ?? 'left',
        lineBreak: style.width !== undefined,
      });
  };
  const heightOf = (
    value: string,
    width: number,
    size: number,
    font: 'Helvetica' | 'Helvetica-Bold' = 'Helvetica',
  ) => doc.font(font).fontSize(size).heightOfString(pdfSafe(value), { width });
  const rule = (y: number, color = LINE, weight = 0.7) => {
    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .lineWidth(weight)
      .strokeColor(color)
      .stroke();
  };

  let y = MARGIN;

  // --- Header: the seller on the left; invoice number, date, order number and PAID on the right.
  doc.roundedRect(MARGIN, y, 30, 30, 6).fill(ORANGE);
  text('R', MARGIN, y + 7, {
    font: 'Helvetica-Bold',
    size: 16,
    color: '#ffffff',
    width: 30,
    align: 'center',
  });
  text('RALLY', MARGIN + 40, y + 3, { font: 'Helvetica-Bold', size: 14 });
  text('Play it your way', MARGIN + 40, y + 19, { size: 7, color: MUTED });

  const sellerWidth = 280;
  let sellerY = y + 44;
  text(invoice.seller.name, MARGIN, sellerY, {
    font: 'Helvetica-Bold',
    size: 9,
    width: sellerWidth,
  });
  sellerY += 13;
  text(invoice.seller.address, MARGIN, sellerY, {
    size: 8,
    color: MUTED,
    width: sellerWidth,
  });
  sellerY += heightOf(invoice.seller.address, sellerWidth, 8) + 3;
  text(
    `${invoice.seller.taxOffice} · Tax no. ${invoice.seller.taxNumber}`,
    MARGIN,
    sellerY,
    { size: 8, color: MUTED, width: sellerWidth },
  );
  sellerY += 12;

  const rightX = PAGE_WIDTH - MARGIN - 200;
  const right = { width: 200, align: 'right' as const };
  text('INVOICE', rightX, y, { size: 7, color: MUTED, ...right });
  text(invoice.invoiceNumber, rightX, y + 11, {
    font: 'Helvetica-Bold',
    size: 13,
    ...right,
  });
  text(formatInvoiceDate(invoice.issuedAt), rightX, y + 30, {
    size: 8,
    color: MUTED,
    ...right,
  });
  text(`Order ${invoice.orderNumber}`, rightX, y + 42, {
    size: 8,
    color: MUTED,
    ...right,
  });
  let headEnd = sellerY;
  if (invoice.paid) {
    doc
      .roundedRect(PAGE_WIDTH - MARGIN - 40, y + 58, 40, 15, 7.5)
      .fill(GREEN_BG);
    text('PAID', PAGE_WIDTH - MARGIN - 40, y + 62, {
      font: 'Helvetica-Bold',
      size: 8,
      color: GREEN,
      width: 40,
      align: 'center',
    });
    headEnd = Math.max(headEnd, y + 73);
  }
  y = headEnd + 12;
  rule(y);
  y += 16;

  // --- BILLED TO and DELIVER TO.
  const colWidth = (CONTENT_WIDTH - 20) / 2;
  const deliverX = MARGIN + colWidth + 20;
  const billedLines = [
    invoice.billedTo.email,
    ...invoice.billedTo.address.split(/\r?\n/),
  ];
  const deliverLines = addressLines(
    invoice.deliverTo.address,
    invoice.deliverTo.postalCode,
    invoice.deliverTo.city,
  );
  text('BILLED TO', MARGIN, y, { size: 7, color: MUTED });
  text('DELIVER TO', deliverX, y, { size: 7, color: MUTED });
  text(invoice.billedTo.name, MARGIN, y + 12, {
    font: 'Helvetica-Bold',
    size: 9,
    width: colWidth,
  });
  text(invoice.deliverTo.recipient, deliverX, y + 12, {
    font: 'Helvetica-Bold',
    size: 9,
    width: colWidth,
  });
  let billedY = y + 25;
  for (const line of billedLines) {
    text(line, MARGIN, billedY, { size: 8, color: MUTED, width: colWidth });
    billedY += heightOf(line, colWidth, 8) + 2;
  }
  let deliverY = y + 25;
  for (const line of deliverLines) {
    text(line, deliverX, deliverY, { size: 8, color: MUTED, width: colWidth });
    deliverY += heightOf(line, colWidth, 8) + 2;
  }
  y = Math.max(billedY, deliverY) + 14;

  // --- Items table.
  const drawTableHead = () => {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(HEAD_BG);
    let x = MARGIN;
    for (const column of COLUMNS) {
      text(column.title, x + 6, y + 7, {
        font: 'Helvetica-Bold',
        size: 6.5,
        color: MUTED,
        width: column.width - 12,
        align: column.align,
      });
      x += column.width;
    }
    y += 20;
  };
  drawTableHead();
  invoice.items.forEach((item, index) => {
    const cells = [
      String(index + 1),
      item.name,
      item.model ?? '-',
      String(item.quantity),
      money(item.unitListPrice),
      formatDiscount(item.discountRate),
      money(item.unitPricePaid),
      money(item.lineTotal),
    ];
    const rowHeight =
      Math.max(
        ...cells.map((cell, i) => heightOf(cell, COLUMNS[i].width - 12, 8)),
      ) + 14;
    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawTableHead();
    }
    let x = MARGIN;
    cells.forEach((cell, i) => {
      text(cell, x + 6, y + 7, {
        size: 8,
        width: COLUMNS[i].width - 12,
        align: COLUMNS[i].align,
      });
      x += COLUMNS[i].width;
    });
    y += rowHeight;
    rule(y);
  });
  y += 14;

  // --- Totals box: Subtotal, Discounts, Delivery, Tax (8%), TOTAL PAID.
  const totalsRows: Array<[string, string]> = [
    ['Subtotal', money(invoice.subtotal)],
    [
      'Discounts',
      invoice.discountTotal > 0 ? `-${money(invoice.discountTotal)}` : money(0),
    ],
    ['Delivery', invoice.deliveryFee > 0 ? money(invoice.deliveryFee) : 'Free'],
    ['Tax (8%)', money(invoice.tax)],
  ];
  const footerHeight = 70;
  if (y + totalsRows.length * 20 + 34 + footerHeight > PAGE_BOTTOM) {
    doc.addPage();
    y = MARGIN;
  }
  const totalsWidth = 230;
  const totalsX = PAGE_WIDTH - MARGIN - totalsWidth;
  for (const [label, value] of totalsRows) {
    text(label, totalsX, y, { size: 9, width: totalsWidth / 2 });
    text(value, totalsX + totalsWidth / 2, y, {
      font: 'Helvetica-Bold',
      size: 9,
      width: totalsWidth / 2,
      align: 'right',
    });
    y += 20;
  }
  doc
    .moveTo(totalsX, y - 4)
    .lineTo(PAGE_WIDTH - MARGIN, y - 4)
    .lineWidth(1.5)
    .strokeColor(NAVY)
    .stroke();
  text('TOTAL PAID', totalsX, y + 4, {
    font: 'Helvetica-Bold',
    size: 11,
    width: totalsWidth / 2,
  });
  text(money(invoice.total), totalsX + totalsWidth / 2, y + 4, {
    font: 'Helvetica-Bold',
    size: 11,
    width: totalsWidth / 2,
    align: 'right',
  });
  y += 38;

  // --- Footer: how it was paid and the returns promise.
  rule(y);
  y += 12;
  const { payment } = invoice;
  if (payment) {
    const paidBy = `Paid by ${payment.cardBrand ?? 'card'} •••• ${payment.cardLast4 ?? '----'}`;
    text(
      payment.transactionRef
        ? `${paidBy} · Ref ${payment.transactionRef}`
        : paidBy,
      MARGIN,
      y,
      { size: 8, color: MUTED },
    );
    y += 14;
  }
  text('Returns accepted within 30 days of delivery.', MARGIN, y, {
    size: 8,
    color: MUTED,
  });

  doc.end();
  return done;
}

/** The download name: the invoice number, with nothing that could break a header. */
export function invoicePdfFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
}
