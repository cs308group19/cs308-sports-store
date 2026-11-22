import { Module } from '@nestjs/common';
import { CartController, GuestCartController } from './cart.controller.js';
import { PrismaCartStore, PrismaProductLookup } from './cart.prisma.js';
import { CART_STORE, CartService, PRODUCT_LOOKUP } from './cart.service.js';
import { CartViewService } from './cart.view.js';

/** SCRUM-16 and SCRUM-17. Guest and customer carts, stored in the database. */
@Module({
  controllers: [CartController, GuestCartController],
  providers: [
    CartService,
    CartViewService,
    { provide: CART_STORE, useClass: PrismaCartStore },
    { provide: PRODUCT_LOOKUP, useClass: PrismaProductLookup },
  ],
  exports: [CartService],
})
export class CartModule {}
