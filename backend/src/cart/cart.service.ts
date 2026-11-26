import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CartItem,
  type CartStore,
  MAX_QUANTITY_PER_ITEM,
  type ProductLookup,
} from './cart.types.js';

export const CART_STORE = Symbol('CART_STORE');
export const PRODUCT_LOOKUP = Symbol('PRODUCT_LOOKUP');

/**
 * SCRUM-16 and SCRUM-17. Adds and removes cart items and changes their quantity, never beyond
 * the stock, and moves a guest cart into the customer's cart at login.
 */
@Injectable()
export class CartService {
  constructor(
    @Inject(CART_STORE) private readonly store: CartStore,
    @Inject(PRODUCT_LOOKUP) private readonly products: ProductLookup,
  ) {}

  getCart(ownerKey: string): Promise<CartItem[]> {
    return this.store.load(requireOwner(ownerKey));
  }

  async addItem(
    ownerKey: string,
    productId: string,
    quantity = 1,
  ): Promise<CartItem[]> {
    const owner = requireOwner(ownerKey);
    requireQuantity(quantity);
    const stock = await this.stockOf(productId);

    return this.store.update(owner, (items) => {
      const existing = items.find((item) => item.productId === productId);
      const requested = (existing?.quantity ?? 0) + quantity;

      if (requested > MAX_QUANTITY_PER_ITEM) {
        throw new BadRequestException(
          `You can add at most ${MAX_QUANTITY_PER_ITEM} of one product.`,
        );
      }
      if (requested > stock) {
        throw new BadRequestException(`Only ${stock} left in stock.`);
      }

      return existing
        ? items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: requested }
              : item,
          )
        : [...items, { productId, quantity }];
    });
  }

  /** Sets the quantity of a product that is already in the cart (the + and − buttons). */
  async updateQuantity(
    ownerKey: string,
    productId: string,
    quantity: number,
  ): Promise<CartItem[]> {
    const owner = requireOwner(ownerKey);
    requireQuantity(quantity);
    // Looked up before the cart is locked, so the lock is held as briefly as possible.
    const stock = await this.stockOf(productId);
    if (quantity > stock) {
      throw new BadRequestException(`Only ${stock} left in stock.`);
    }

    return this.store.update(owner, (items) => {
      if (!items.some((item) => item.productId === productId)) {
        throw new NotFoundException('This product is not in the cart.');
      }
      return items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      );
    });
  }

  async removeItem(ownerKey: string, productId: string): Promise<CartItem[]> {
    const owner = requireOwner(ownerKey);
    return this.store.update(owner, (items) => {
      const next = items.filter((item) => item.productId !== productId);
      if (next.length === items.length) {
        throw new NotFoundException('This product is not in the cart.');
      }
      return next;
    });
  }

  /**
   * SCRUM-17. Moves a guest cart into a customer cart at login. Quantities of the same product are
   * added and capped at the stock (and the per-product maximum). Products that were removed or
   * sold out are dropped. The guest cart is emptied afterwards.
   */
  async mergeGuestCart(guestKey: string, userKey: string): Promise<CartItem[]> {
    const guest = requireOwner(guestKey);
    const user = requireOwner(userKey);
    if (guest === user) return this.store.load(user);

    // Read, add and empty in one step in the store, so nothing is copied twice and nothing is lost.
    // The store reads the stock in the same step; checkout checks it again (SCRUM-24).
    return this.store.merge(guest, user, (guestItems, userItems, stockById) => {
      const quantities = new Map(
        userItems.map((item) => [item.productId, item.quantity]),
      );
      for (const item of guestItems) {
        const stock = stockById.get(item.productId);
        if (stock === undefined) continue;
        const combined = (quantities.get(item.productId) ?? 0) + item.quantity;
        const capped = Math.min(combined, stock, MAX_QUANTITY_PER_ITEM);
        if (capped > 0) quantities.set(item.productId, capped);
      }
      return [...quantities].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    });
  }

  /** Stock of a product a customer may buy. Out-of-stock products cannot go in the cart. */
  private async stockOf(productId: string): Promise<number> {
    const product = await this.products.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (product.stock <= 0) {
      throw new BadRequestException('This product is out of stock.');
    }
    return product.stock;
  }
}

function requireQuantity(quantity: number): void {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY_PER_ITEM
  ) {
    throw new BadRequestException(
      `Quantity must be a whole number between 1 and ${MAX_QUANTITY_PER_ITEM}.`,
    );
  }
}

function requireOwner(ownerKey: string): string {
  const trimmed = ownerKey.trim();
  if (!trimmed) {
    throw new BadRequestException('A cart owner is required.');
  }
  return trimmed;
}
