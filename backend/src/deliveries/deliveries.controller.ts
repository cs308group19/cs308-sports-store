import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { parseId } from '../common/id.js';
import { Roles } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';
import { UpdateDeliveryStatusDto } from './deliveries.dto.js';
import { DeliveriesService } from './deliveries.service.js';
import { type DeliveryStep, isDeliveryStep } from './delivery.rules.js';

/** An empty ?status= means no filter; anything but processing, in_transit or delivered is a 400. */
export function parseStatusFilter(raw: unknown): DeliveryStep | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string' || !isDeliveryStep(raw)) {
    throw new BadRequestException(
      'status must be processing, in_transit or delivered.',
    );
  }
  return raw;
}

/** SCRUM-34. Only product managers open these routes; every other role gets 403. */
@Roles(UserRole.product_manager)
@Controller('staff/deliveries')
export class DeliveriesController {
  constructor(
    @Inject(DeliveriesService) private readonly deliveries: DeliveriesService,
  ) {}

  /** GET /api/staff/deliveries?status=processing */
  @Get()
  list(@Query('status') status?: unknown) {
    return this.deliveries.list(parseStatusFilter(status));
  }

  /** PATCH /api/staff/deliveries/12 with { "status": "in_transit" } */
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() body: UpdateDeliveryStatusDto) {
    return this.deliveries.updateStatus(
      parseId(id, 'delivery id'),
      body.status,
    );
  }
}
