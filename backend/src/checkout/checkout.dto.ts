import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsObject,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { isCardExpiry, isCardNumber } from './card-validation.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class ReviewedCartItemDto {
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  lineTotalCents!: number;
}

export class ReviewedCartDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReviewedCartItemDto)
  items!: ReviewedCartItemDto[];

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  totalCents!: number;
}

export class CheckoutDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewedCartDto)
  reviewedCart!: ReviewedCartDto;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  deliveryRecipient!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 500)
  deliveryAddress!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  @Matches(/\p{L}/u, { message: 'Enter the name on the card.' })
  cardholderName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[ -]/g, '') : value,
  )
  @ValidateBy({
    name: 'cardNumber',
    validator: {
      validate: isCardNumber,
      defaultMessage: () => 'Enter a valid card number.',
    },
  })
  cardNumber!: string;

  @Transform(trim)
  @ValidateBy({
    name: 'cardExpiry',
    validator: {
      validate: (value: unknown) => isCardExpiry(value),
      defaultMessage: () =>
        'Enter an expiry month in MM/YY format that has not passed.',
    },
  })
  expiry!: string;

  @Transform(trim)
  @Matches(/^\d{3,4}$/, { message: 'Enter a 3- or 4-digit security code.' })
  cvv!: string;
}
