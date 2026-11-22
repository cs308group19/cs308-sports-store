import type { CartItem, CartStore } from './cart.types.js';

/**
 * In-memory cart storage. Carts are lost on restart, so this is only for development and tests
 * until the database-backed store is added.
 */
export class InMemoryCartStore implements CartStore {
  private readonly carts = new Map<string, CartItem[]>();

  async load(ownerKey: string): Promise<CartItem[]> {
    return (this.carts.get(ownerKey) ?? []).map((item) => ({ ...item }));
  }

  async save(ownerKey: string, items: CartItem[]): Promise<void> {
    this.carts.set(
      ownerKey,
      items.map((item) => ({ ...item })),
    );
  }
}
