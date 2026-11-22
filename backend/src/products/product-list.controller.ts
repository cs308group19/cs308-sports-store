import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import {
  parseCategorySlug,
  parseSearchQuery,
  parseSort,
  ProductListService,
} from './product-list.service.js';

/** SCRUM-13, 28 and 29. Guests can browse, search and sort the shop without logging in (feature 4). */
@Controller()
export class ProductListController {
  constructor(
    @Inject(ProductListService)
    private readonly productList: ProductListService,
  ) {}

  /**
   * GET /api/products?category=running&q=trail+shoe&sort=price-asc
   * Every parameter is optional. `q` searches names and descriptions (SCRUM-28); `sort` is
   * popularity (default), price-asc or price-desc (SCRUM-29).
   */
  @Public()
  @Get('products')
  findAll(
    @Query('category') category?: unknown,
    @Query('q') q?: unknown,
    @Query('sort') sort?: unknown,
  ) {
    return this.productList.listProducts({
      categorySlug: parseCategorySlug(category),
      search: parseSearchQuery(q),
      sort: parseSort(sort),
    });
  }

  /** GET /api/categories */
  @Public()
  @Get('categories')
  categories() {
    return this.productList.listCategories();
  }
}
