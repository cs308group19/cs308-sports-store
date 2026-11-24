import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { CheckoutDto } from './checkout.dto.js';
import { CheckoutService, type CheckoutResponse } from './checkout.service.js';
import { authorizeMockPayment } from './mock-bank.js';

@Roles(UserRole.customer)
@Controller('me/checkout')
export class CheckoutController {
  constructor(
    @Inject(CheckoutService) private readonly checkout: CheckoutService,
    @Inject(InvoicesService) private readonly invoices: InvoicesService,
  ) {}

  @Post()
  async placeOrder(
    @CurrentUser() user: AuthUser,
    @Body() body: CheckoutDto,
  ): Promise<CheckoutResponse> {
    const card = authorizeMockPayment(body.cardNumber);
    if (!card) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Payment was declined.',
          error: 'Payment Required',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const order = await this.checkout.placeOrder(
      user.id,
      {
        deliveryRecipient: body.deliveryRecipient,
        deliveryAddress: body.deliveryAddress,
      },
      card,
      body.reviewedCart,
    );
    void this.invoices.sendInvoiceEmail(order.invoiceId);
    return order;
  }
}
