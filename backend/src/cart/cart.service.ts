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

/** SCRUM-16. Adds and removes cart items and changes their quantity, never beyond the stock. */
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
  async setQuantity(
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
