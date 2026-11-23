import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { checkoutTotals, priceOrderItem } from './checkout-totals.js';
import type { ReviewedCartDto } from './checkout.dto.js';

const CART_CHANGED = 'Your cart or prices have changed.';

interface DeliveryDetails {
  deliveryRecipient: string;
  deliveryAddress: string;
}

interface ApprovedCard {
  cardBrand: string;
  cardLast4: string;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  invoiceId: string;
}

@Injectable()
export class CheckoutService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async placeOrder(
    userId: string,
    delivery: DeliveryDetails,
    card: ApprovedCard,
    reviewedCart: ReviewedCartDto,
  ): Promise<CheckoutResponse> {
    const reference = randomBytes(8).toString('hex').toUpperCase();
    const orderNumber = `RLY-${reference}`;
    const reviewedItems = new Map(
      reviewedCart.items.map((item) => [item.productId, item]),
    );

    return this.prisma.$transaction(
      async (tx) => {
        // Cart writes also lock this row. Read the items after acquiring the lock.
        const [cart] = await tx.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM public.carts WHERE user_id = ${userId}::uuid FOR UPDATE`;
        if (!cart) throw new ConflictException('Your cart is empty.');

        const cartItems = await tx.cartItem.findMany({
          where: { cartId: cart.id, product: { isActive: true } },
          select: { productId: true, quantity: true },
          orderBy: { productId: 'asc' },
        });
        if (cartItems.length === 0) {
          throw new ConflictException('Your cart is empty.');
        }
        if (
          reviewedItems.size !== reviewedCart.items.length ||
          reviewedItems.size !== cartItems.length ||
          cartItems.some(
            ({ productId, quantity }) =>
              reviewedItems.get(productId.toString())?.quantity !== quantity,
          )
        ) {
          throw new ConflictException(CART_CHANGED);
        }

        const lines = [];
        // A consistent product lock order lets different carts share products safely.
        for (const { productId, quantity } of cartItems) {
          const [product] = await tx.product.updateManyAndReturn({
            where: {
              id: productId,
              isActive: true,
              stockQuantity: { gte: quantity },
            },
            data: {
              stockQuantity: { decrement: quantity },
              popularity: { increment: quantity },
            },
            select: {
              name: true,
              model: true,
              price: true,
              discountRate: true,
              cost: true,
            },
          });
          if (!product) {
            throw new ConflictException(
              'An item in your cart is no longer available in the requested quantity.',
            );
          }
          const price = priceOrderItem(
            product.price,
            product.discountRate,
            quantity,
          );
          if (
            price.lineCents !==
            reviewedItems.get(productId.toString())?.lineTotalCents
          ) {
            throw new ConflictException(CART_CHANGED);
          }
          lines.push({
            productId,
            quantity,
            productName: product.name,
            productModel: product.model,
            unitCost: product.cost ?? 0,
            ...price,
          });
        }

        const totals = checkoutTotals(lines);
        if (Math.round(totals.totalAmount * 100) !== reviewedCart.totalCents) {
          throw new ConflictException(CART_CHANGED);
        }
        const order = await tx.order.create({
          data: {
            userId,
            orderNumber,
            status: 'processing',
            ...delivery,
            ...totals,
          },
          select: { id: true },
        });
        const deliveries = [];
        for (const [
          index,
          { lineCents, listCents: _listCents, ...line },
        ] of lines.entries()) {
          const lineTotal = lineCents / 100;
          const item = await tx.orderItem.create({
            data: { orderId: order.id, ...line, lineTotal },
            select: { id: true },
          });
          deliveries.push({
            deliveryNumber: `DLV-${reference}-${index + 1}`,
            orderId: order.id,
            orderItemId: item.id,
            customerId: userId,
            productId: line.productId,
            quantity: line.quantity,
            totalPrice: lineTotal,
            deliveryAddress: delivery.deliveryAddress,
            status: 'processing' as const,
          });
        }
        await tx.delivery.createMany({ data: deliveries });
        await tx.payment.create({
          data: {
            orderId: order.id,
            status: 'succeeded',
            amount: totals.totalAmount,
            ...card,
            transactionRef: `TXN-${reference}`,
            processedAt: new Date(),
          },
        });
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: `INV-${reference}`,
            orderId: order.id,
            userId,
            billedToName: delivery.deliveryRecipient,
            billedToAddress: delivery.deliveryAddress,
            subtotal: totals.subtotal,
            deliveryFee: totals.deliveryFee,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
            emailStatus: 'pending',
          },
          select: { id: true },
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({
          where: { id: cart.id },
          data: { updatedAt: new Date() },
        });

        return {
          orderId: order.id.toString(),
          orderNumber,
          invoiceId: invoice.id.toString(),
        };
      },
      { maxWait: 10_000, timeout: 15_000 },
    );
  }
}
