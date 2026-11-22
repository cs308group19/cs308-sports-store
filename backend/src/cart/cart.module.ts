import { Module } from '@nestjs/common';
import { CartController } from './cart.controller.js';
import { CART_STORE, CartService, PRODUCT_LOOKUP } from './cart.service.js';
import { PrismaCartStore, PrismaProductLookup } from './cart.store.prisma.js';
import { CartViewService } from './cart.view.js';

/** SCRUM-16. The shopping cart, stored in the database. */
@Module({
  controllers: [CartController],
  providers: [
    CartService,
    CartViewService,
    { provide: CART_STORE, useClass: PrismaCartStore },
    { provide: PRODUCT_LOOKUP, useClass: PrismaProductLookup },
  ],
  exports: [CartService],
})
export class CartModule {}
