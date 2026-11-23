import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  StreamableFile,
} from '@nestjs/common';
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

  /** SCRUM-26. The invoice as a PDF download, named after the invoice number. */
  @Get(':id/pdf')
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const { filename, content } = await this.invoices.getPdfForUser(
      user.id,
      parseId(id, 'invoice id'),
    );
    return new StreamableFile(content, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
      length: content.length,
    });
  }
}
