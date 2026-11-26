import { IsIn } from 'class-validator';
import { OrderStatus } from './delivery.rules.js';

export class UpdateDeliveryStatusDto {
  /** "cancelled" is a known status, so it passes here and the rules answer it with a 409. */
  @IsIn(Object.values(OrderStatus), {
    message: 'status must be processing, in_transit or delivered.',
  })
  status!: OrderStatus;
}
