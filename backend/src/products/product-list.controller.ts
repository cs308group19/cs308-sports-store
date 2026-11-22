import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import {
  parseCategorySlug,
  parseSearchQuery,
  ProductListService,
} from './product-list.service.js';

/** SCRUM-13 and 28. Guests can browse and search the shop without logging in (feature 4). */
@Controller()
export class ProductListController {
  constructor(
    @Inject(ProductListService)
    private readonly productList: ProductListService,
  ) {}

  /**
   * GET /api/products?category=running&q=trail+shoe
   * Both parameters are optional. `q` searches names and descriptions (SCRUM-28).
   */
  @Public()
  @Get('products')
  findAll(@Query('category') category?: unknown, @Query('q') q?: unknown) {
    return this.productList.listProducts({
      categorySlug: parseCategorySlug(category),
      search: parseSearchQuery(q),
    });
  }

  /** GET /api/categories */
  @Public()
  @Get('categories')
  categories() {
    return this.productList.listCategories();
  }
}
