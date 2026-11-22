import { IsInt, IsOptional, IsPositive } from 'class-validator';

/** POST /api/cart/items and /api/me/cart/items. The service checks the quantity range and stock. */
export class AddCartItemDto {
  @IsInt()
  @IsPositive()
  productId!: number;

  @IsOptional()
  @IsInt()
  quantity?: number;
}

/** PATCH /api/cart/items/:productId and /api/me/cart/items/:productId */
export class UpdateCartQuantityDto {
  @IsInt()
  quantity!: number;
}
