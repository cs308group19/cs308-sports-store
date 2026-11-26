import { catalogueId } from '../common/id.js';
import { type DecimalLike, roundToCents, toNumber } from '../common/money.js';
import {
  type OrderHistoryItem,
  type OrderHistoryLine,
  type OrderHistoryStatus,
  ORDER_HISTORY_STATUSES,
} from './order-history.types.js';

/** The rows one order is shown from. Prisma returns NUMERIC columns as Decimal. */
export interface OrderHistoryRecord {
  id: bigint;
  orderNumber: string;
  status: string;
  totalAmount: DecimalLike;
  createdAt: Date;
  invoice: { id: bigint } | null;
  items: Array<{
    id: bigint;
    productId: bigint;
    productName: string;
    productModel: string | null;
    quantity: number;
    unitPricePaid: DecimalLike;
    lineTotal: DecimalLike;
    product: { imageUrl: string | null };
  }>;
}

function isOrderHistoryStatus(value: string): value is OrderHistoryStatus {
  return (ORDER_HISTORY_STATUSES as readonly string[]).includes(value);
}

/** The line is shown as the customer paid for it. The product name is the one stored on the order, so a later rename does not change it. */
function toLine(item: OrderHistoryRecord['items'][number]): OrderHistoryLine {
  return {
    id: catalogueId(item.id),
    productId: catalogueId(item.productId),
    name: item.productName,
    model: item.productModel,
    imageUrl: item.product.imageUrl,
    quantity: item.quantity,
    unitPricePaid: roundToCents(toNumber(item.unitPricePaid)),
    lineTotal: roundToCents(toNumber(item.lineTotal)),
  };
}

/** Turns one saved order into the entry GET /api/me/orders returns. */
export function toOrderHistoryItem(record: OrderHistoryRecord): OrderHistoryItem {
  if (!isOrderHistoryStatus(record.status)) {
    throw new TypeError(`Unknown order status: ${record.status}`);
  }
  return {
    id: catalogueId(record.id),
    orderNumber: record.orderNumber,
    placedAt: record.createdAt.toISOString(),
    status: record.status,
    total: roundToCents(toNumber(record.totalAmount)),
    invoiceId: record.invoice ? catalogueId(record.invoice.id) : null,
    items: record.items.map(toLine),
  };
}
