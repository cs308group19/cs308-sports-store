import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProductSummary } from '../products/product-detail.mapper.js';
import type { ProductSummaryResponse } from '../products/product-detail.types.js';
import { PRODUCT_SUMMARY_SELECT } from '../products/product.select.js';
import { cartOwnerWhere } from './cart.owner.js';

export interface CartLineResponse {
  product: ProductSummaryResponse;
  quantity: number;
  /** The product's price after discount times the quantity. */
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
 * Reads a cart with the product details the cart page shows (same fields as the shop list), the
 * total of each line and of the whole cart. Prices are the discounted prices the shop shows.
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
            product: { select: { ...PRODUCT_SUMMARY_SELECT, isActive: true } },
          },
        },
      },
    });

    const items = (cart?.items ?? [])
      // A product a manager removed from the store is no longer for sale.
      .filter((item) => item.product.isActive)
      .map((item) => {
        const product = toProductSummary(item.product);
        return {
          product,
          quantity: item.quantity,
          lineTotal: (toCents(product.price) * item.quantity) / 100,
        };
      });
    const totalCents = items.reduce(
      (sum, item) => sum + toCents(item.lineTotal),
      0,
    );
    return { items, total: totalCents / 100 };
  }
}
