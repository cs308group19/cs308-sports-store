import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import type { OrderHistoryItem } from './order-history.types.js';
import { OrderHistoryService } from './order-history.service.js';

/** SCRUM-27. The signed-in customer's own order history. */
@Controller('me/orders')
export class OrderHistoryController {
  constructor(
    @Inject(OrderHistoryService) private readonly orders: OrderHistoryService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@CurrentUser() user: AuthUser): Promise<OrderHistoryItem[]> {
    return this.orders.listForUser(user.id);
  }
}
