import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { parseId } from '../common/id.js';
import { AddCartItemDto, UpdateCartItemDto } from './cart.dto.js';
import { CartOwner } from './cart.owner.js';
import { CartService } from './cart.service.js';
import { type CartResponse, CartViewService } from './cart.view.js';

/**
 * SCRUM-16. Guests can fill a cart without logging in (feature 4). The cart is identified by the
 * X-Cart-Token header the browser generates once and keeps.
 */
@Public()
@Controller('cart')
export class CartController {
  constructor(
    @Inject(CartService) private readonly cart: CartService,
    @Inject(CartViewService) private readonly cartView: CartViewService,
  ) {}

  /** GET /api/cart */
  @Get()
  get(@CartOwner() owner: string): Promise<CartResponse> {
    return this.cartView.view(owner);
  }

  /** POST /api/cart/items { productId, quantity? }. Adding a product again raises its quantity. */
  @Post('items')
  async add(
    @CartOwner() owner: string,
    @Body() body: AddCartItemDto,
  ): Promise<CartResponse> {
    await this.cart.addItem(owner, String(body.productId), body.quantity ?? 1);
    return this.cartView.view(owner);
  }

  /** PATCH /api/cart/items/:productId { quantity } */
  @Patch('items/:productId')
  async update(
    @CartOwner() owner: string,
    @Param('productId') productId: string,
    @Body() body: UpdateCartItemDto,
  ): Promise<CartResponse> {
    const id = parseId(productId, 'product id').toString();
    await this.cart.setQuantity(owner, id, body.quantity);
    return this.cartView.view(owner);
  }

  /** DELETE /api/cart/items/:productId */
  @Delete('items/:productId')
  async remove(
    @CartOwner() owner: string,
    @Param('productId') productId: string,
  ): Promise<CartResponse> {
    const id = parseId(productId, 'product id').toString();
    await this.cart.removeItem(owner, id);
    return this.cartView.view(owner);
  }
}
