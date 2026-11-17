export interface CartItem {
  productId: string;
  quantity: number;
}

/** The part of a product the cart needs: whether it exists and how many are in stock. */
export interface ProductSnapshot {
  id: string;
  stock: number;
}

/** Looks up products. Backed by the database once the store tables exist (SCRUM-12). */
export interface ProductLookup {
  findById(productId: string): Promise<ProductSnapshot | null>;
}

/**
 * Stores carts by owner. The owner key is the signed-in user's id, or a guest cart id
 * for visitors who are not logged in. Guest carts move to the user after login (SCRUM-17).
 */
export interface CartStore {
  load(ownerKey: string): Promise<CartItem[]>;
  save(ownerKey: string, items: CartItem[]): Promise<void>;
}

export const MAX_QUANTITY_PER_ITEM = 99;
