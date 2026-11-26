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
  /**
   * SCRUM-17. Moves the guest cart into the customer's cart as one step. `change` receives both
   * carts and the stock of every active product in the guest cart, read in the same step, and
   * returns the customer's new lines. The guest cart is emptied in the same step, so if anything
   * fails nothing is moved, and two merges of the same guest cart never copy it twice. When there
   * is no guest cart, or it is empty, `change` is not called and nothing is written.
   */
  merge(
    guestKey: string,
    userKey: string,
    change: MergeChange,
  ): Promise<CartItem[]>;
}

export type MergeChange = (
  guestItems: CartItem[],
  userItems: CartItem[],
  /** Stock by product id. A product that is missing or inactive has no entry. */
  stockById: ReadonlyMap<string, number>,
) => CartItem[];

export type CartChange = (
  items: CartItem[],
) => CartItem[] | Promise<CartItem[]>;

export const MAX_QUANTITY_PER_ITEM = 99;
