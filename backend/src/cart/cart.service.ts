import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CartItem,
  type CartStore,
  type CartView,
  type CartViewItem,
  MAX_QUANTITY_PER_ITEM,
  type ProductLookup,
} from './cart.types.js';

export const CART_STORE = Symbol('CART_STORE');
export const PRODUCT_LOOKUP = Symbol('PRODUCT_LOOKUP');

/** Adds, removes and changes the quantity of cart items. */
@Injectable()
export class CartService {
  constructor(
    @Inject(CART_STORE) private readonly store: CartStore,
    @Inject(PRODUCT_LOOKUP) private readonly products: ProductLookup,
  ) {}

  getCart(ownerKey: string): Promise<CartItem[]> {
    return this.store.load(requireOwner(ownerKey));
  }

  /** The cart with product details, prices and the total, as the storefront displays it. */
  async view(ownerKey: string): Promise<CartView> {
    const items = await this.store.load(requireOwner(ownerKey));
    const lines: CartViewItem[] = [];
    for (const item of items) {
      const product = await this.products.findById(item.productId);
      if (!product) continue;
      const lineTotal = Math.round(product.price * item.quantity * 100) / 100;
      lines.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.stock,
        quantity: item.quantity,
        lineTotal,
      });
    }
    const total = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
    return { items: lines, total };
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

  async updateQuantity(
    ownerKey: string,
    productId: string,
    quantity: number,
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

    const items = await this.store.load(owner);
    if (!items.some((item) => item.productId === productId)) {
      throw new NotFoundException('This product is not in the cart.');
    }
    if (quantity > product.stock) {
      throw new BadRequestException(`Only ${product.stock} left in stock.`);
    }

    const next = items.map((item) =>
      item.productId === productId ? { ...item, quantity } : item,
    );

    await this.store.save(owner, next);
    return next;
  }

  /**
   * Moves a guest cart into a customer cart at login. Quantities of the same product are added
   * and capped at the stock. The guest cart is emptied afterwards.
   */
  async mergeGuestCart(guestKey: string, userKey: string): Promise<CartItem[]> {
    const guest = requireOwner(guestKey);
    const user = requireOwner(userKey);
    const guestItems = await this.store.load(guest);
    const userItems = await this.store.load(user);

    if (guest === user || guestItems.length === 0) {
      return userItems;
    }

    const merged = new Map<string, number>(
      userItems.map((item) => [item.productId, item.quantity]),
    );

    for (const item of guestItems) {
      const product = await this.products.findById(item.productId);
      if (!product) {
        continue;
      }
      const combined = (merged.get(item.productId) ?? 0) + item.quantity;
      const capped = Math.min(combined, product.stock);
      if (capped > 0) {
        merged.set(item.productId, capped);
      }
    }

    const next = [...merged].map(([productId, quantity]) => ({ productId, quantity }));

    await this.store.save(user, next);
    await this.store.save(guest, []);
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
