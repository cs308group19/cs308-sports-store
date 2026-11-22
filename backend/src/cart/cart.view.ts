import { Inject, Injectable } from '@nestjs/common';
import { applyDiscount, toNumber } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cartOwnerWhere } from './cart.owner.js';

/** One cart line as the cart and checkout pages show it (frontend CartViewItem). */
export interface CartLineResponse {
  productId: string;
  name: string;
  /** The price the customer pays: the list price after the product's discount. */
  price: number;
  imageUrl: string | null;
  stock: number;
  quantity: number;
  /** price × quantity. */
  lineTotal: number;
}

/** GET /api/cart, GET /api/me/cart and the answer to every cart change. */
export interface CartResponse {
  items: CartLineResponse[];
  /** Sum of the line totals, before delivery and tax. */
  total: number;
}

const toCents = (amount: number) => Math.round(amount * 100);

/**
 * SCRUM-16 and SCRUM-17. Reads a cart with the name, discounted price, image and stock of each
 * product, the total of each line and of the whole cart. Totals are added up in cents.
 */
@Injectable()
export class CartViewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async view(ownerKey: string): Promise<CartResponse> {
    const where = cartOwnerWhere(ownerKey);
    const cart = await this.prisma.cart.findUnique({
      where,
      select: {
        items: {
          orderBy: { id: 'asc' },
          select: {
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discountRate: true,
                imageUrl: true,
                stockQuantity: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    const items = (cart?.items ?? [])
      // A product a manager removed from the store is no longer for sale.
      .filter((item) => item.product.isActive)
      .map(({ product, quantity }) => {
        const price = applyDiscount(
          toNumber(product.price),
          toNumber(product.discountRate),
        );
        return {
          productId: product.id.toString(),
          name: product.name,
          price,
          imageUrl: product.imageUrl,
          stock: product.stockQuantity,
          quantity,
          lineTotal: (toCents(price) * quantity) / 100,
        };
      });
    const totalCents = items.reduce(
      (sum, item) => sum + toCents(item.lineTotal),
      0,
    );
    return { items, total: totalCents / 100 };
  }
}
