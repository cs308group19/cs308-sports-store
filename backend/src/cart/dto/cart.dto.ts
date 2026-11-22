import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../cart.types.js';

export class AddCartItemDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'productId must be a product id.' })
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity?: number;
}

export class UpdateCartQuantityDto {
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}
