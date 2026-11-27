import { Module } from '@nestjs/common';
import { OrderHistoryModule } from '../orders/order-history.module.js';
import { ProductDetailModule } from '../products/product-detail.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantRateLimitGuard } from './assistant.rate-limit.js';
import { AssistantService } from './assistant.service.js';
import { AssistantTools } from './assistant.tools.js';
import { GeminiClient } from './gemini.client.js';

/** SCRUM-113. The chat assistant, built on the shop's product and order history services. */
@Module({
  imports: [ProductDetailModule, OrderHistoryModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantTools,
    GeminiClient,
    AssistantRateLimitGuard,
  ],
})
export class AssistantModule {}
