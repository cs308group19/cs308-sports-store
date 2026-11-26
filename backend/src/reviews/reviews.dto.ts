import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class SubmitReviewDto {
  @IsDefined()
  orderItemId!: unknown;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment?: string;
}
