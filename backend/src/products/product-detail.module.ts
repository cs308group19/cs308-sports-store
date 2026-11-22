import { Module } from '@nestjs/common';
import { ProductDetailController } from './product-detail.controller.js';
import { ProductDetailService } from './product-detail.service.js';
import { ProductListController } from './product-list.controller.js';
import { ProductListService } from './product-list.service.js';

/** Customer-facing catalogue: the shop list (SCRUM-13) and the product page (SCRUM-14). */
@Module({
  controllers: [ProductListController, ProductDetailController],
  providers: [ProductListService, ProductDetailService],
  exports: [ProductListService, ProductDetailService],
})
export class ProductDetailModule {}
