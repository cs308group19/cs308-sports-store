import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { parseId } from '../common/id.js';
import {
  guestOwnerKey,
  GUEST_TOKEN_HEADER,
  userOwnerKey,
} from './cart.owner.js';
import { CartService } from './cart.service.js';
import { type CartResponse, CartViewService } from './cart.view.js';
import { AddCartItemDto, UpdateCartQuantityDto } from './dto/cart.dto.js';

/** Cart ids are strings inside the service; the path must still be a valid product id. */
function productIdParam(raw: string): string {
  return parseId(raw, 'product id').toString();
}

/**
 * SCRUM-17. Cart for a signed-in customer. Requires a Supabase session. Every change returns the
 * new cart.
 */
@Controller('me/cart')
export class CartController {
  constructor(
    @Inject(CartService) private readonly carts: CartService,
    @Inject(CartViewService) private readonly cartView: CartViewService,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser): Promise<CartResponse> {
    return this.cartView.view(userOwnerKey(user.id));
  }

  @Post('items')
  async add(@CurrentUser() user: AuthUser, @Body() body: AddCartItemDto) {
    const owner = userOwnerKey(user.id);
    await this.carts.addItem(owner, String(body.productId), body.quantity ?? 1);
    return this.cartView.view(owner);
  }

  @Patch('items/:productId')
  async updateQuantity(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() body: UpdateCartQuantityDto,
  ) {
    const owner = userOwnerKey(user.id);
    await this.carts.updateQuantity(
      owner,
      productIdParam(productId),
      body.quantity,
    );
    return this.cartView.view(owner);
  }

  @Delete('items/:productId')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    const owner = userOwnerKey(user.id);
    await this.carts.removeItem(owner, productIdParam(productId));
    return this.cartView.view(owner);
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
    return this.cartView.view(owner);
  }
}

/**
 * SCRUM-16. Cart for a visitor who is not signed in (feature 4). The browser sends its random
 * token in the X-Cart-Token header.
 */
@Public()
@Controller('cart')
export class GuestCartController {
  constructor(
    @Inject(CartService) private readonly carts: CartService,
    @Inject(CartViewService) private readonly cartView: CartViewService,
  ) {}

  @Get()
  async get(@Headers(GUEST_TOKEN_HEADER) token: string | undefined) {
    return this.cartView.view(guestOwnerKey(token));
  }

  @Post('items')
  async add(
    @Headers(GUEST_TOKEN_HEADER) token: string | undefined,
    @Body() body: AddCartItemDto,
  ) {
    const owner = guestOwnerKey(token);
    await this.carts.addItem(owner, String(body.productId), body.quantity ?? 1);
    return this.cartView.view(owner);
  }

  @Patch('items/:productId')
  async updateQuantity(
    @Headers(GUEST_TOKEN_HEADER) token: string | undefined,
    @Param('productId') productId: string,
    @Body() body: UpdateCartQuantityDto,
  ) {
    const owner = guestOwnerKey(token);
    await this.carts.updateQuantity(
      owner,
      productIdParam(productId),
      body.quantity,
    );
    return this.cartView.view(owner);
  }

  @Delete('items/:productId')
  async remove(
    @Headers(GUEST_TOKEN_HEADER) token: string | undefined,
    @Param('productId') productId: string,
  ) {
    const owner = guestOwnerKey(token);
    await this.carts.removeItem(owner, productIdParam(productId));
    return this.cartView.view(owner);
  }
}
