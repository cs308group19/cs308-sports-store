import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { cartOwnerWhere } from './cart.owner.js';
import type {
  CartChange,
  CartItem,
  CartStore,
  ProductLookup,
  ProductSnapshot,
} from './cart.types.js';

/** SCRUM-16 and SCRUM-17. Keeps guest and customer carts in the `carts` and `cart_items` tables. */
@Injectable()
export class PrismaCartStore implements CartStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(ownerKey: string): Promise<CartItem[]> {
    const cart = await this.prisma.cart.findUnique({
      where: cartOwnerWhere(ownerKey),
      select: {
        items: {
          orderBy: { id: 'asc' },
          select: { productId: true, quantity: true },
        },
      },
    });
    return (cart?.items ?? []).map(toCartItem);
  }

  /**
   * Runs in one transaction that locks the cart row, so two requests for the same cart (a double
   * click, two tabs) wait for each other instead of failing or losing one of the changes.
   */
  async update(ownerKey: string, change: CartChange): Promise<CartItem[]> {
    const owner = cartOwnerWhere(ownerKey);
    return this.prisma.$transaction(
      async (tx) => {
        // One statement creates the cart on first use or, if it exists, locks its row until the
        // transaction ends. Another request for this cart waits here and then sees our change.
        const [cart] =
          'guestToken' in owner
            ? await tx.$queryRaw<{ id: bigint }[]>`
              INSERT INTO public.carts (guest_token) VALUES (${owner.guestToken})
              ON CONFLICT (guest_token) DO UPDATE SET updated_at = now()
              RETURNING id`
            : await tx.$queryRaw<{ id: bigint }[]>`
              INSERT INTO public.carts (user_id) VALUES (${owner.userId}::uuid)
              ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
              RETURNING id`;

        const current = await tx.cartItem.findMany({
          where: { cartId: cart.id },
          orderBy: { id: 'asc' },
          select: { productId: true, quantity: true },
        });
        const next = await change(current.map(toCartItem));

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        if (next.length > 0) {
          await tx.cartItem.createMany({
            data: next.map((item) => ({
              cartId: cart.id,
              productId: BigInt(item.productId),
              quantity: item.quantity,
            })),
          });
        }
        return next;
      },
      // The lock wait counts towards the timeout, so leave room for a few queued requests.
      { maxWait: 10_000, timeout: 15_000 },
    );
  }
}

function toCartItem(row: { productId: bigint; quantity: number }): CartItem {
  return { productId: row.productId.toString(), quantity: row.quantity };
}

/** Products a customer can put in the cart: active ones, with their current stock. */
@Injectable()
export class PrismaProductLookup implements ProductLookup {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(productId: string): Promise<ProductSnapshot | null> {
    // A positive whole number that fits the BIGINT id column; anything else cannot exist.
    if (!/^[1-9]\d{0,17}$/.test(productId)) return null;
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(productId), isActive: true },
      select: { id: true, stockQuantity: true },
    });
    return product
      ? { id: product.id.toString(), stock: product.stockQuantity }
      : null;
  }
}
