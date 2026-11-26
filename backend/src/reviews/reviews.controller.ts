import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';
import { parseId } from '../common/id.js';
import { SubmitReviewDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

function parseOrderItemId(raw: unknown): bigint {
  if (typeof raw === 'string') return parseId(raw, 'order item id');
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) {
    return parseId(String(raw), 'order item id');
  }
  throw new BadRequestException('Invalid order item id.');
}

@Roles(UserRole.customer)
@Controller('me/reviews')
export class ReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
  ) {}

  @Post()
  submit(@CurrentUser() customer: AuthUser, @Body() body: SubmitReviewDto) {
    return this.reviews.submit(
      customer.id,
      parseOrderItemId(body.orderItemId),
      body.rating,
      body.comment,
    );
  }
}
