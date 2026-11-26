import { vi } from 'vitest';

/**
 * SCRUM-34. A small in-memory stand-in for the `orders`, `deliveries` and `products` tables, with
 * just the Prisma calls the delivery service makes. A transaction that throws is rolled back, like
 * in PostgreSQL, so the tests can check that a refused change writes nothing.
 */
export type Status = 'processing' | 'in_transit' | 'delivered' | 'cancelled';
const STATUS_ORDER: Status[] = [
  'processing',
  'in_transit',
  'delivered',
  'cancelled',
];

export interface OrderRecord {
  id: bigint;
  orderNumber: string;
  userId: string;
  status: Status;
  deliveredAt: Date | null;
  updatedAt: Date;
}

export interface DeliveryRecord {
  id: bigint;
  deliveryNumber: string;
  orderId: bigint;
  orderItemId: bigint;
  customerId: string;
  productId: bigint;
  quantity: number;
  totalPrice: string;
  deliveryAddress: string;
  status: Status;
  isCompleted: boolean;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface State {
  orders: OrderRecord[];
  deliveries: DeliveryRecord[];
}

export function createDeliveriesDb(productNames: Record<string, string> = {}) {
  let state: State = { orders: [], deliveries: [] };
  let nextDeliveryId = 1n;
  let nextOrderId = 1n;
  const clock = { now: new Date('2026-11-20T10:00:00Z') };
  /** Runs right before a conditional update, to act as a second manager who got there first. */
  const hooks: { beforeUpdateMany?: () => void } = {};
  /** Every order lock taken, in order, so a test can see that the order row was locked. */
  const locks: bigint[] = [];

  const tick = () => {
    clock.now = new Date(clock.now.getTime() + 60_000);
    return clock.now;
  };

  /**
   * Creates an order with one delivery row per item, the way checkout will (status processing,
   * one row per order item).
   */
  function addOrder(
    items: { productId: bigint; quantity: number; totalPrice: string }[],
    options: {
      userId?: string;
      orderNumber?: string;
      address?: string;
      statuses?: Status[];
    } = {},
  ) {
    const id = nextOrderId++;
    const order: OrderRecord = {
      id,
      orderNumber: options.orderNumber ?? `RLY-${String(id).padStart(6, '0')}`,
      userId: options.userId ?? 'customer-1',
      status: 'processing',
      deliveredAt: null,
      updatedAt: clock.now,
    };
    state.orders.push(order);
    const rows = items.map((item, index) => {
      const deliveryId = nextDeliveryId++;
      const row: DeliveryRecord = {
        id: deliveryId,
        deliveryNumber: `DLV-${String(deliveryId).padStart(6, '0')}`,
        orderId: id,
        orderItemId: deliveryId + 100n,
        customerId: order.userId,
        productId: item.productId,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        deliveryAddress: options.address ?? '123 Fast Lane, Istanbul',
        status: options.statuses?.[index] ?? 'processing',
        isCompleted: options.statuses?.[index] === 'delivered',
        deliveredAt: null,
        createdAt: tick(),
        updatedAt: clock.now,
      };
      state.deliveries.push(row);
      return row;
    });
    return { order, deliveries: rows };
  }

  const orderOf = (id: bigint) =>
    state.orders.find((order) => order.id === id) as OrderRecord;

  const withRelations = (row: DeliveryRecord) => ({
    ...row,
    order: { orderNumber: orderOf(row.orderId).orderNumber },
    product: { name: productNames[String(row.productId)] ?? 'Test product' },
  });

  const delivery = {
    findMany: vi.fn(
      ({
        where,
      }: {
        where?: { status?: Status; orderId?: bigint };
      } = {}) => {
        const rows = state.deliveries
          .filter(
            (row) =>
              (where?.status === undefined || row.status === where.status) &&
              (where?.orderId === undefined || row.orderId === where.orderId),
          )
          .sort(
            (a, b) =>
              STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
              a.createdAt.getTime() - b.createdAt.getTime() ||
              Number(a.id - b.id),
          );
        return Promise.resolve(rows.map(withRelations));
      },
    ),
    findUnique: vi.fn(({ where }: { where: { id: bigint } }) => {
      const row = state.deliveries.find((r) => r.id === where.id);
      return Promise.resolve(row ? withRelations(row) : null);
    }),
    findUniqueOrThrow: vi.fn(({ where }: { where: { id: bigint } }) => {
      const row = state.deliveries.find((r) => r.id === where.id);
      return row
        ? Promise.resolve(withRelations(row))
        : Promise.reject(new Error('No Delivery found'));
    }),
    updateMany: vi.fn(
      ({
        where,
        data,
      }: {
        where: { id: bigint; status: Status };
        data: Partial<DeliveryRecord>;
      }) => {
        hooks.beforeUpdateMany?.();
        const row = state.deliveries.find(
          (r) => r.id === where.id && r.status === where.status,
        );
        if (row) Object.assign(row, data);
        return Promise.resolve({ count: row ? 1 : 0 });
      },
    ),
  };

  const order = {
    update: vi.fn(
      ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: Partial<OrderRecord>;
      }) => {
        const row = orderOf(where.id);
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      },
    ),
  };

  const client = {
    delivery,
    order,
    // The `SELECT status FROM orders WHERE id = ... FOR UPDATE` lock.
    $queryRaw: vi.fn((_sql: TemplateStringsArray, orderId: bigint) => {
      locks.push(orderId);
      const row = state.orders.find((o) => o.id === orderId);
      return Promise.resolve(row ? [{ status: row.status }] : []);
    }),
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => {
      const before = structuredClone(state);
      try {
        return await fn(client);
      } catch (error) {
        state = before;
        throw error;
      }
    }),
    profile: { findUnique: vi.fn() },
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };

  return {
    client,
    addOrder,
    hooks,
    locks,
    tick,
    get orders() {
      return state.orders;
    },
    get deliveries() {
      return state.deliveries;
    },
    reset() {
      state = { orders: [], deliveries: [] };
      nextDeliveryId = 1n;
      nextOrderId = 1n;
      locks.length = 0;
      hooks.beforeUpdateMany = undefined;
      clock.now = new Date('2026-11-20T10:00:00Z');
      vi.clearAllMocks();
    },
  };
}
