import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { parseId } from '../common/id.js';
import type { InvoiceResponse } from './invoice.types.js';
import { InvoicesService } from './invoices.service.js';

/** SCRUM-25. The signed-in customer's own invoices. Any other invoice answers 404. */
@Controller('me/invoices')
export class InvoicesController {
  constructor(
    @Inject(InvoicesService) private readonly invoices: InvoicesService,
  ) {}

  @Get(':id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<InvoiceResponse> {
    return this.invoices.getForUser(user.id, parseId(id, 'invoice id'));
  }
}
