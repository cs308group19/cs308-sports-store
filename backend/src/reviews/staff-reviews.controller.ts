import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';
import { parseId } from '../common/id.js';
import { ModerateReviewDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@Roles(UserRole.product_manager)
@Controller('staff/reviews')
export class StaffReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query('status') status?: unknown) {
    if (status !== undefined && status !== 'pending') {
      throw new BadRequestException('status must be pending.');
    }
    return this.reviews.listPending();
  }

  @Patch(':id')
  moderate(
    @Param('id') id: string,
    @CurrentUser() staff: AuthUser,
    @Body() body: ModerateReviewDto,
  ) {
    return this.reviews.moderate(
      parseId(id, 'review id'),
      staff.id,
      body.status,
    );
  }
}
