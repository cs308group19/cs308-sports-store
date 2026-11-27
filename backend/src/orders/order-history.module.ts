import { Module } from '@nestjs/common';
import { OrderHistoryController } from './order-history.controller.js';
import { OrderHistoryService } from './order-history.service.js';

/** SCRUM-27. The customer's order history page. */
@Module({
  controllers: [OrderHistoryController],
  providers: [OrderHistoryService],
  exports: [OrderHistoryService],
})
export class OrderHistoryModule {}
