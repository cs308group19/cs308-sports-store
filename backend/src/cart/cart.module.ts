import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CartController, GuestCartController } from './cart.controller.js';
import { PrismaCartStore, PrismaProductLookup } from './cart.prisma.js';
import { CART_STORE, CartService, PRODUCT_LOOKUP } from './cart.service.js';

@Module({
  controllers: [CartController, GuestCartController],
  providers: [
    CartService,
    { provide: CART_STORE, inject: [PrismaService], useFactory: (prisma: PrismaService) => new PrismaCartStore(prisma) },
    { provide: PRODUCT_LOOKUP, inject: [PrismaService], useFactory: (prisma: PrismaService) => new PrismaProductLookup(prisma) },
  ],
})
export class CartModule {}
