import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { StaffReviewsController } from './staff-reviews.controller.js';

@Module({
  controllers: [ReviewsController, StaffReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
