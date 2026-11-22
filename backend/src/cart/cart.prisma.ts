import type { PrismaService } from '../prisma/prisma.service.js';
import { type CartOwner, parseOwnerKey } from './cart.owner.js';
import type { CartItem, CartStore, ProductLookup, ProductSnapshot } from './cart.types.js';

function ownerWhere(owner: CartOwner) {
  return owner.kind === 'user' ? { userId: owner.userId } : { guestToken: owner.token };
}

/** Stores carts in the carts and cart_items tables. */
export class PrismaCartStore implements CartStore {
  constructor(private readonly prisma: PrismaService) {}

  async load(ownerKey: string): Promise<CartItem[]> {
    const cart = await this.prisma.cart.findUnique({
      where: ownerWhere(parseOwnerKey(ownerKey)),
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!cart) return [];
    return cart.items.map((item) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
    }));
  }

  async save(ownerKey: string, items: CartItem[]): Promise<void> {
    const owner = parseOwnerKey(ownerKey);
    const where = ownerWhere(owner);

    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where,
        create: where,
        update: {},
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (items.length > 0) {
        await tx.cartItem.createMany({
          data: items.map((item) => ({
            cartId: cart.id,
            productId: BigInt(item.productId),
            quantity: item.quantity,
          })),
        });
      }
    });
  }
}

/** Reads products that can be sold. Inactive products are treated as not found. */
export class PrismaProductLookup implements ProductLookup {
  constructor(private readonly prisma: PrismaService) {}

  async findById(productId: string): Promise<ProductSnapshot | null> {
    if (!/^\d+$/.test(productId)) return null;

    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(productId), isActive: true },
      select: { id: true, stockQuantity: true, name: true, price: true, imageUrl: true },
    });
    if (!product) return null;
    return {
      id: product.id.toString(),
      stock: product.stockQuantity,
      name: product.name,
      price: product.price.toNumber(),
      imageUrl: product.imageUrl,
    };
  }
}
