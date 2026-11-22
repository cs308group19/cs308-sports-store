import { Module } from '@nestjs/common';
import { ProductDetailController } from './product-detail.controller.js';
import { ProductDetailService } from './product-detail.service.js';

@Module({
  controllers: [ProductDetailController],
  providers: [ProductDetailService],
  exports: [ProductDetailService],
})
export class ProductDetailModule {}
