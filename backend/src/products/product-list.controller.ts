import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { parseCategorySlug, ProductListService } from './product-list.service.js';

/** SCRUM-13. Guests can browse the shop without logging in (feature 4). */
@Controller()
export class ProductListController {
  constructor(
    @Inject(ProductListService)
    private readonly productList: ProductListService,
  ) {}

  /** GET /api/products?category=running */
  @Public()
  @Get('products')
  findAll(@Query('category') category?: unknown) {
    return this.productList.listProducts(parseCategorySlug(category));
  }

  /** GET /api/categories */
  @Public()
  @Get('categories')
  categories() {
    return this.productList.listCategories();
  }
}
