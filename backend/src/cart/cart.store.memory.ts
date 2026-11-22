import type { CartChange, CartItem, CartStore } from './cart.types.js';

/**
 * In-memory cart storage for the unit tests. The app itself uses PrismaCartStore
 * (cart.store.prisma.ts), which keeps carts in the database.
 */
export class InMemoryCartStore implements CartStore {
  private readonly carts = new Map<string, CartItem[]>();
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
}

function copy(items: CartItem[]): CartItem[] {
  return items.map((item) => ({ ...item }));
}
