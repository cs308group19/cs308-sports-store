import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { createSupabaseJwks, JWKS } from './auth/jwks.js';
import { RolesGuard } from './auth/roles.guard.js';
import { SupabaseJwtGuard } from './auth/supabase-jwt.guard.js';
import { CartModule } from './cart/cart.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { type Env, validateEnv } from './config/env.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { HealthController } from './health/health.controller.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { OrderHistoryModule } from './orders/order-history.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductDetailModule } from './products/product-detail.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { StaffController } from './staff/staff.controller.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CryptoModule,
    SupabaseModule,
    UsersModule,
    AuthModule,
    ProductDetailModule,
    CartModule,
    InvoicesModule,
    CheckoutModule,
    DeliveriesModule,
    OrderHistoryModule,
    ReviewsModule,
  ],
  controllers: [HealthController, StaffController],
  providers: [
    {
      provide: JWKS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createSupabaseJwks(
          config.get('SUPABASE_URL', { infer: true }),
          config.get('SUPABASE_JWT_SECRET', { infer: true }),
        ),
    },
    // Guards run in this order: rate limit, then authenticate, then check the role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
