import { IsInt, IsOptional, IsPositive } from 'class-validator';

/** POST /api/cart/items. The service checks the quantity range and the stock. */
export class AddCartItemDto {
  @IsInt()
  @IsPositive()
  productId!: number;

  @IsOptional()
  @IsInt()
  quantity?: number;
}

/** PATCH /api/cart/items/:productId */
export class UpdateCartItemDto {
  @IsInt()
  quantity!: number;
}
