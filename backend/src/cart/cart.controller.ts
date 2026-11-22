import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { guestOwnerKey, GUEST_TOKEN_HEADER, userOwnerKey } from './cart.owner.js';
import { AddCartItemDto, UpdateCartQuantityDto } from './dto/cart.dto.js';
import { CartService } from './cart.service.js';

/** Cart for a signed-in customer. Requires a Supabase session. Every change returns the new cart. */
@Controller('me/cart')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    return this.carts.view(userOwnerKey(user.id));
  }

  @Post('items')
  async add(@CurrentUser() user: AuthUser, @Body() body: AddCartItemDto) {
    const owner = userOwnerKey(user.id);
    await this.carts.addItem(owner, body.productId, body.quantity ?? 1);
    return this.carts.view(owner);
  }

  @Patch('items/:productId')
  async updateQuantity(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() body: UpdateCartQuantityDto,
  ) {
    const owner = userOwnerKey(user.id);
    await this.carts.updateQuantity(owner, productId, body.quantity);
    return this.carts.view(owner);
  }

  @Delete('items/:productId')
  async remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    const owner = userOwnerKey(user.id);
    await this.carts.removeItem(owner, productId);
    return this.carts.view(owner);
  }

  /** Called right after login: moves the guest cart named by the header into the customer cart. */
  @Post('merge')
  @HttpCode(200)
  async merge(
    @CurrentUser() user: AuthUser,
    @Headers(GUEST_TOKEN_HEADER) guestToken: string | undefined,
  ) {
    const owner = userOwnerKey(user.id);
    await this.carts.mergeGuestCart(guestOwnerKey(guestToken), owner);
    return this.carts.view(owner);
  }
}

/** Cart for a visitor who is not signed in. The browser sends its token in the x-cart-token header. */
@Public()
@Controller('cart')
export class GuestCartController {
  constructor(private readonly carts: CartService) {}

  @Get()
  async get(@Headers(GUEST_TOKEN_HEADER) token: string | undefined) {
    return this.carts.view(guestOwnerKey(token));
  }

  @Post('items')
  async add(@Headers(GUEST_TOKEN_HEADER) token: string | undefined, @Body() body: AddCartItemDto) {
    const owner = guestOwnerKey(token);
    await this.carts.addItem(owner, body.productId, body.quantity ?? 1);
    return this.carts.view(owner);
  }

  @Patch('items/:productId')
  async updateQuantity(
    @Headers(GUEST_TOKEN_HEADER) token: string | undefined,
    @Param('productId') productId: string,
    @Body() body: UpdateCartQuantityDto,
  ) {
    const owner = guestOwnerKey(token);
    await this.carts.updateQuantity(owner, productId, body.quantity);
    return this.carts.view(owner);
  }

  @Delete('items/:productId')
  async remove(
    @Headers(GUEST_TOKEN_HEADER) token: string | undefined,
    @Param('productId') productId: string,
  ) {
    const owner = guestOwnerKey(token);
    await this.carts.removeItem(owner, productId);
    return this.carts.view(owner);
  }
}
