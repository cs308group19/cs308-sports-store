import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';

/**
 * Placeholder endpoints that show how each staff role is protected. The real product, sales and
 * support modules will use the same @Roles() decorator. Permissions stay separate: a sales
 * manager cannot open the product manager endpoint and the other way around.
 */
@Controller('staff')
export class StaffController {
  @Get('product-manager')
  @Roles(UserRole.product_manager)
  productManager(@CurrentUser() user: AuthUser) {
    return {
      role: user.role,
      area: 'Product management',
      capabilities: [
        'Manage products, categories and stock',
        'Process deliveries and update order status',
        'Approve or reject written comments',
      ],
    };
  }

  @Get('sales-manager')
  @Roles(UserRole.sales_manager)
  salesManager(@CurrentUser() user: AuthUser) {
    return {
      role: user.role,
      area: 'Sales management',
      capabilities: [
        'Set prices and discounts',
        'Inspect invoices',
        'View revenue and profit/loss reports',
        'Evaluate and authorize refunds',
      ],
    };
  }

  @Get('support-agent')
  @Roles(UserRole.support_agent)
  supportAgent(@CurrentUser() user: AuthUser) {
    return {
      role: user.role,
      area: 'Customer support',
      capabilities: [
        'Claim customer conversations',
        'Reply in real time and exchange attachments',
        'View permitted customer information',
      ],
    };
  }
}
