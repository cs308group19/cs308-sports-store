export interface CartItem {
  productId: string;
  quantity: number;
}

/** The part of a product the cart needs: whether it exists and how many are in stock. */
export interface ProductSnapshot {
  id: string;
  stock: number;
}

/** Looks up products a customer may buy (active ones). */
export interface ProductLookup {
  findById(productId: string): Promise<ProductSnapshot | null>;
}

/**
 * Stores carts by owner. The owner key is the signed-in user's id, or a guest cart id
 * for visitors who are not logged in. Guest carts move to the user after login (SCRUM-17).
 */
export interface CartStore {
  load(ownerKey: string): Promise<CartItem[]>;
  /**
   * Reads the cart, lets `change` compute the new lines and saves them, as one step: two requests
   * for the same cart run one after the other, so neither overwrites the other's change. When
   * `change` throws, nothing is saved and the error is passed on.
   */
  update(ownerKey: string, change: CartChange): Promise<CartItem[]>;
}

export type CartChange = (
  items: CartItem[],
) => CartItem[] | Promise<CartItem[]>;

export const MAX_QUANTITY_PER_ITEM = 99;
