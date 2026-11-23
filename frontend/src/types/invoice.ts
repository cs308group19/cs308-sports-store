/** GET /api/me/invoices/:id (backend/src/invoices/invoice.types.ts). Ids are text: they are BIGINTs. */
export interface InvoiceLine {
  name: string;
  model: string | null;
  quantity: number;
  unitListPrice: number;
  /** Percent, 0–100. */
  discountRate: number;
  unitPricePaid: number;
  lineTotal: number;
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  /** ISO 8601. */
  issuedAt: string;
  orderNumber: string;
  status: string;
  paid: boolean;
  seller: { name: string; address: string; taxOffice: string; taxNumber: string };
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
  discountTotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  currency: string;
  payment: {
    cardBrand: string | null;
    cardLast4: string | null;
    transactionRef: string | null;
    processedAt: string | null;
  } | null;
}
