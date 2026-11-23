/** Who sells. Printed on the invoice page and on the PDF, so both always show the same block. */
export interface InvoiceSeller {
  name: string;
  address: string;
  taxOffice: string;
  taxNumber: string;
}

export interface InvoiceLine {
  name: string;
  model: string | null;
  quantity: number;
  /** Price per unit before the discount. */
  unitListPrice: number;
  /** Percent, 0–100. */
  discountRate: number;
  /** Price per unit the customer paid. */
  unitPricePaid: number;
  /** unitPricePaid × quantity, as saved at order time. */
  lineTotal: number;
}

export interface InvoicePayment {
  cardBrand: string | null;
  /** Last four digits only. The full number and the CVV are never stored. */
  cardLast4: string | null;
  transactionRef: string | null;
  processedAt: string | null;
}

/**
 * SCRUM-25. GET /api/me/invoices/:id. Everything comes from the records saved at order time
 * (invoices, orders, order_items, payments), so a later price change never alters an old invoice.
 * Ids are strings because database ids are BIGINT.
 */
export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  /** ISO 8601. */
  issuedAt: string;
  orderNumber: string;
  /** Order status: processing, in_transit, delivered or cancelled. */
  status: string;
  /** True when a succeeded payment is saved for the order. */
  paid: boolean;
  seller: InvoiceSeller;
  billedTo: { name: string; email: string; address: string };
  deliverTo: {
    recipient: string;
    address: string;
    city: string | null;
    postalCode: string | null;
  };
  items: InvoiceLine[];
  /** Sum of the list prices, before discounts. */
  subtotal: number;
  /** What the discounts took off the list prices. */
  discountTotal: number;
  deliveryFee: number;
  tax: number;
  /** subtotal − discountTotal + deliveryFee + tax. */
  total: number;
  currency: string;
  payment: InvoicePayment | null;
}
