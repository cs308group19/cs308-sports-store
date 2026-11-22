import { Controller, Get, Inject, Param } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { parseId } from '../common/id.js';
import { ProductDetailService } from './product-detail.service.js';

/** SCRUM-14. Guests can open a product page without logging in (feature 4). */
@Controller('products')
export class ProductDetailController {
  constructor(
    @Inject(ProductDetailService)
    private readonly productDetail: ProductDetailService,
  ) {}

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productDetail.findById(parseId(id, 'product id'));
  }
}
