import type {
  CartChange,
  CartItem,
  CartStore,
  MergeChange,
  ProductLookup,
} from './cart.types.js';

/**
 * In-memory cart storage for the unit tests. The app itself uses PrismaCartStore
 * (cart.prisma.ts), which keeps carts in the database.
 */
export class InMemoryCartStore implements CartStore {
  private readonly carts = new Map<string, CartItem[]>();

  /** `products` gives the stock a merge caps at, like the products table does for PrismaCartStore. */
  constructor(
    private readonly products: ProductLookup = { findById: async () => null },
  ) {}
  /** The last pending update per owner, so updates to one cart run one after the other. */
  private readonly queues = new Map<string, Promise<unknown>>();

  async load(ownerKey: string): Promise<CartItem[]> {
    return copy(this.carts.get(ownerKey) ?? []);
  }

  update(ownerKey: string, change: CartChange): Promise<CartItem[]> {
    const previous = this.queues.get(ownerKey) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const items = await change(await this.load(ownerKey));
        this.carts.set(ownerKey, copy(items));
        return copy(items);
      });
    this.queues.set(ownerKey, next);
    return next;
  }

  merge(
    guestKey: string,
    userKey: string,
    change: MergeChange,
  ): Promise<CartItem[]> {
    const previous = Promise.all([
      this.queues.get(guestKey) ?? Promise.resolve(),
      this.queues.get(userKey) ?? Promise.resolve(),
    ]);
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const guestItems = await this.load(guestKey);
        const userItems = await this.load(userKey);
        if (guestItems.length === 0) return userItems;

        const stockById = new Map<string, number>();
        for (const item of guestItems) {
          const product = await this.products.findById(item.productId);
          if (product) stockById.set(item.productId, product.stock);
        }
        const merged = change(guestItems, userItems, stockById);
        this.carts.set(userKey, copy(merged));
        this.carts.set(guestKey, []);
        return copy(merged);
      });
    this.queues.set(guestKey, next);
    this.queues.set(userKey, next);
    return next;
  }

  /** Test helper: puts lines straight into a cart, skipping the service's stock checks. */
  async save(ownerKey: string, items: CartItem[]): Promise<void> {
    this.carts.set(ownerKey, copy(items));
  }
}

function copy(items: CartItem[]): CartItem[] {
  return items.map((item) => ({ ...item }));
}
