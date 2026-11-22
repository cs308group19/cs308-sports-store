import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProductSummary } from '../products/product-detail.mapper.js';
import type { ProductSummaryResponse } from '../products/product-detail.types.js';
import { PRODUCT_SUMMARY_SELECT } from '../products/product.select.js';
import { cartOwnerWhere } from './cart.owner.js';

export interface CartLineResponse {
  product: ProductSummaryResponse;
  quantity: number;
}

/** GET /api/cart and the answer to every cart change. */
export interface CartResponse {
  items: CartLineResponse[];
}

/** Reads a cart with the product details the cart page shows (same fields as the shop list). */
@Injectable()
export class CartViewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async view(ownerKey: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({
      where: cartOwnerWhere(ownerKey),
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

    return {
      items: (cart?.items ?? [])
        // A product a manager removed from the store is no longer for sale.
        .filter((item) => item.product.isActive)
        .map((item) => ({
          product: toProductSummary(item.product),
          quantity: item.quantity,
        })),
    };
  }
}
