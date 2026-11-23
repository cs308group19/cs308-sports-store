import { type DecimalLike, toNumber } from '../common/money.js';
import { INVOICE_SELLER } from './invoice.seller.js';
import type { InvoiceLine, InvoiceResponse } from './invoice.types.js';

/** The rows one invoice is built from. Prisma returns NUMERIC columns as Decimal. */
export interface InvoiceRecord {
  id: bigint;
  invoiceNumber: string;
  issuedAt: Date;
  billedToName: string;
  billedToAddress: string;
  /** Present once the delivery_fee migration (SCRUM-24) is merged. */
  deliveryFee?: DecimalLike | null;
  user: { email: string | null };
  order: {
    orderNumber: string;
    status: string;
    taxAmount: DecimalLike;
    totalAmount: DecimalLike;
    deliveryRecipient: string;
    deliveryAddress: string;
    deliveryCity: string | null;
    deliveryPostalCode: string | null;
    /** Present once the delivery_fee migration (SCRUM-24) is merged. */
    deliveryFee?: DecimalLike | null;
    items: Array<{
      id: bigint;
      productName: string;
      productModel: string | null;
      quantity: number;
      unitListPrice: DecimalLike;
      discountRate: DecimalLike;
      unitPricePaid: DecimalLike;
      lineTotal: DecimalLike;
    }>;
    payments: Array<{
      status: string;
      currency: string;
      cardBrand: string | null;
      cardLast4: string | null;
      transactionRef: string | null;
      processedAt: Date | null;
    }>;
  };
}

const toCents = (value: DecimalLike) => Math.round(toNumber(value) * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * Delivery fee in cents. Uses the saved column when there is one. Until then, it is worked out
 * from the saved amounts: the order total minus the tax minus what the lines cost. Those lines
 * already carry their discounts, so the discounts must not be added back (total − subtotal − tax
 * + discounts would charge a discounted order a fee it never paid).
 */
function deliveryFeeCents(record: InvoiceRecord, paidLinesCents: number) {
  const saved = record.order.deliveryFee ?? record.deliveryFee;
  if (saved !== null && saved !== undefined) return toCents(saved);
  const derived =
    toCents(record.order.totalAmount) -
    toCents(record.order.taxAmount) -
    paidLinesCents;
  return Math.max(0, derived);
}

/** Turns the saved rows into the invoice the page, the PDF and the email all use. */
export function toInvoiceResponse(record: InvoiceRecord): InvoiceResponse {
  const { order } = record;
  const items: InvoiceLine[] = [...order.items]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((item) => ({
      name: item.productName,
      model: item.productModel,
      quantity: item.quantity,
      unitListPrice: toNumber(item.unitListPrice),
      discountRate: toNumber(item.discountRate),
      unitPricePaid: toNumber(item.unitPricePaid),
      lineTotal: toNumber(item.lineTotal),
    }));

  // Everything is added up in whole cents, so 0.1 + 0.2 style errors never reach the invoice.
  const listCents = order.items.reduce(
    (sum, item) => sum + toCents(item.unitListPrice) * item.quantity,
    0,
  );
  const paidLinesCents = order.items.reduce(
    (sum, item) => sum + toCents(item.lineTotal),
    0,
  );
  const discountCents = Math.max(0, listCents - paidLinesCents);
  const feeCents = deliveryFeeCents(record, paidLinesCents);
  const taxCents = toCents(order.taxAmount);

  const payment =
    order.payments.find((candidate) => candidate.status === 'succeeded') ??
    null;

  return {
    id: record.id.toString(),
    invoiceNumber: record.invoiceNumber,
    issuedAt: record.issuedAt.toISOString(),
    orderNumber: order.orderNumber,
    status: order.status,
    paid: payment !== null,
    seller: INVOICE_SELLER,
    billedTo: {
      name: record.billedToName,
      email: record.user.email ?? '',
      address: record.billedToAddress,
    },
    deliverTo: {
      recipient: order.deliveryRecipient,
      address: order.deliveryAddress,
      city: order.deliveryCity,
      postalCode: order.deliveryPostalCode,
    },
    items,
    subtotal: fromCents(listCents),
    discountTotal: fromCents(discountCents),
    deliveryFee: fromCents(feeCents),
    tax: fromCents(taxCents),
    total: toNumber(order.totalAmount),
    currency: payment?.currency ?? 'USD',
    payment: payment
      ? {
          cardBrand: payment.cardBrand,
          cardLast4: payment.cardLast4,
          transactionRef: payment.transactionRef,
          processedAt: payment.processedAt?.toISOString() ?? null,
        }
      : null,
  };
}
