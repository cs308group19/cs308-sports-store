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

/** Adds and removes cart items. Quantity changes are a separate task (SCRUM-16 covers them later). */
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

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_ITEM
    ) {
      throw new BadRequestException(
        `Quantity must be a whole number between 1 and ${MAX_QUANTITY_PER_ITEM}.`,
      );
    }

    const product = await this.products.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (product.stock === 0) {
      throw new BadRequestException('This product is out of stock.');
    }

    const items = await this.store.load(owner);
    const existing = items.find((item) => item.productId === productId);
    const requested = (existing?.quantity ?? 0) + quantity;

    if (requested > product.stock) {
      throw new BadRequestException(
        `Only ${product.stock} left in stock.`,
      );
    }

    const next = existing
      ? items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: requested }
            : item,
        )
      : [...items, { productId, quantity }];

    await this.store.save(owner, next);
    return next;
  }

  async removeItem(ownerKey: string, productId: string): Promise<CartItem[]> {
    const owner = requireOwner(ownerKey);
    const items = await this.store.load(owner);
    const next = items.filter((item) => item.productId !== productId);

    if (next.length === items.length) {
      throw new NotFoundException('This product is not in the cart.');
    }

    await this.store.save(owner, next);
    return next;
  }
}

function requireOwner(ownerKey: string): string {
  const trimmed = ownerKey.trim();
  if (!trimmed) {
    throw new BadRequestException('A cart owner is required.');
  }
  return trimmed;
}
