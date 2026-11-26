import { Inject, Injectable } from '@nestjs/common';
import { isDatabaseId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cartOwnerWhere } from './cart.owner.js';
import type {
  CartChange,
  CartItem,
  CartStore,
  MergeChange,
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
        const cartId = await lockCart(tx, owner);
        const current = await readItems(tx, cartId);
        const next = await change(current);
        await replaceItems(tx, cartId, next);
        return next;
      },
      TRANSACTION_OPTIONS,
    );
  }

  /**
   * SCRUM-17. The guest cart is locked first and the customer cart second, in every merge, so two
   * merges can wait for each other but never deadlock. A second merge of the same guest cart waits
   * for the first, then finds it empty and copies nothing.
   */
  async merge(
    guestKey: string,
    userKey: string,
    change: MergeChange,
  ): Promise<CartItem[]> {
    const guest = cartOwnerWhere(guestKey);
    const user = cartOwnerWhere(userKey);
    return this.prisma.$transaction(async (tx) => {
      const guestCartId = await lockCart(tx, guest);
      const userCartId = await lockCart(tx, user);
      const guestItems = await readItems(tx, guestCartId);
      const userItems = await readItems(tx, userCartId);
      if (guestItems.length === 0) return userItems;

      const next = await change(guestItems, userItems);
      await replaceItems(tx, userCartId, next);
      await tx.cartItem.deleteMany({ where: { cartId: guestCartId } });
      return next;
    }, TRANSACTION_OPTIONS);
  }
}

// The lock wait counts towards the timeout, so leave room for a few queued requests.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

type PrismaTransaction = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0];

/**
 * Creates the cart on first use or, if it exists, locks its row until the transaction ends. Another
 * transaction for this cart waits here and then sees everything the first one wrote.
 */
async function lockCart(
  tx: PrismaTransaction,
  owner: ReturnType<typeof cartOwnerWhere>,
): Promise<bigint> {
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
  return cart.id;
}

async function readItems(
  tx: PrismaTransaction,
  cartId: bigint,
): Promise<CartItem[]> {
  const rows = await tx.cartItem.findMany({
    where: { cartId },
    orderBy: { id: 'asc' },
    select: { productId: true, quantity: true },
  });
  return rows.map(toCartItem);
}

async function replaceItems(
  tx: PrismaTransaction,
  cartId: bigint,
  items: CartItem[],
): Promise<void> {
  await tx.cartItem.deleteMany({ where: { cartId } });
  if (items.length > 0) {
    await tx.cartItem.createMany({
      data: items.map((item) => ({
        cartId,
        productId: BigInt(item.productId),
        quantity: item.quantity,
      })),
    });
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
    // Only a positive whole number that fits the BIGINT id column can exist (same rule as the
    // product page, so every product a customer can open can also go in the cart).
    if (!isDatabaseId(productId)) return null;
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(productId), isActive: true },
      select: { id: true, stockQuantity: true },
    });
    return product
      ? { id: product.id.toString(), stock: product.stockQuantity }
      : null;
  }
}
