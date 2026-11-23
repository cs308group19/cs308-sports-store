import { BadRequestException, Catch, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';

/** JSON parsers and the DTO whitelist can include pieces of invalid input in 400 responses. */
@Catch(BadRequestException)
export class CheckoutValidationFilter extends BaseExceptionFilter<BadRequestException> {
  override catch(exception: BadRequestException, host: ArgumentsHost): void {
    const { method, path } = host.switchToHttp().getRequest<Request>();
    const checkout =
      method === 'POST' && /^\/api\/me\/checkout\/?$/i.test(path);
    super.catch(
      checkout
        ? new BadRequestException('Check your delivery and card details.')
        : exception,
      host,
    );
  }
}
