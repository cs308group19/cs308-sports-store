import { vi } from 'vitest';

/**
 * A small in-memory stand-in for the Prisma calls CheckoutService makes. `$transaction` keeps a
 * copy of the data and puts it back when the callback throws, like a database rollback, so tests
 * can check that a refused order leaves stock, cart and every table as they were.
 */

export interface FakeProduct {
  id: bigint;
  name: string;
  model: string;
  price: string;
  discountRate: string;
  cost: string | null;
  stockQuantity: number;
  popularity: number;
  isActive: boolean;
}

interface State {
  products: FakeProduct[];
  /** Cart of each customer, by user id. */
  carts: Map<string, { id: bigint; items: { productId: bigint; quantity: number }[] }>;
  orders: Record<string, unknown>[];
  orderItems: Record<string, unknown>[];
  deliveries: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
}

type Where = {
  id: bigint;
  isActive: boolean;
  stockQuantity: { gte: number };
};

export function createCheckoutDb(products: FakeProduct[]) {
  const initialProducts = structuredClone(products);
  let state: State = emptyState(initialProducts);

  const tx = {
    $queryRaw: vi.fn(
      async (_sql: TemplateStringsArray, userId: string) => {
        const cart = state.carts.get(userId);
        return cart ? [{ id: cart.id }] : [];
      },
    ),
    cartItem: {
      findMany: vi.fn(async ({ where }: { where: { cartId: bigint } }) => {
        const cart = [...state.carts.values()].find((c) => c.id === where.cartId);
        return (cart?.items ?? [])
          .filter((item) => productById(item.productId)?.isActive)
          .map((item) => ({ ...item }))
          .sort((a, b) => (a.productId < b.productId ? -1 : 1));
      }),
      deleteMany: vi.fn(async ({ where }: { where: { cartId: bigint } }) => {
        const cart = [...state.carts.values()].find((c) => c.id === where.cartId);
        const count = cart?.items.length ?? 0;
        if (cart) cart.items = [];
        return { count };
      }),
    },
    cart: {
      update: vi.fn(async () => ({})),
    },
    product: {
      /** Conditional stock decrease: changes the row only when every condition holds. */
      updateManyAndReturn: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Where;
          data: {
            stockQuantity: { decrement: number };
            popularity: { increment: number };
          };
        }) => {
          const product = productById(where.id);
          if (
            !product ||
            product.isActive !== where.isActive ||
            product.stockQuantity < where.stockQuantity.gte
          ) {
            return [];
          }
          product.stockQuantity -= data.stockQuantity.decrement;
          product.popularity += data.popularity.increment;
          const { name, model, price, discountRate, cost } = product;
          return [{ name, model, price, discountRate, cost }];
        },
      ),
    },
    order: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.orders.push(data);
        return { id: BigInt(state.orders.length) };
      }),
    },
    orderItem: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.orderItems.push(data);
        return { id: BigInt(state.orderItems.length) };
      }),
    },
    delivery: {
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        state.deliveries.push(...data);
        return { count: data.length };
      }),
    },
    payment: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.payments.push(data);
        return {};
      }),
    },
    invoice: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.invoices.push(data);
        return { id: BigInt(state.invoices.length) };
      }),
    },
  };

  const client = {
    $transaction: vi.fn(async <T>(work: (t: typeof tx) => Promise<T>) => {
      const saved = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        state = saved;
        throw error;
      }
    }),
  };

  function productById(id: bigint) {
    return state.products.find((product) => product.id === id);
  }

  return {
    client,
    tx,
    /** Current data, read after an order to check what was written. */
    get state() {
      return state;
    },
    product: (id: bigint) => productById(id)!,
    /** Puts these lines in the customer's cart, creating the cart when needed. */
    fillCart(userId: string, items: { productId: bigint; quantity: number }[]) {
      const existing = state.carts.get(userId);
      const id = existing?.id ?? BigInt(state.carts.size + 1);
      state.carts.set(userId, { id, items: items.map((item) => ({ ...item })) });
    },
    reset() {
      state = emptyState(initialProducts);
      vi.clearAllMocks();
    },
  };
}

function emptyState(products: FakeProduct[]): State {
  return {
    products: structuredClone(products),
    carts: new Map(),
    orders: [],
    orderItems: [],
    deliveries: [],
    payments: [],
    invoices: [],
  };
}
