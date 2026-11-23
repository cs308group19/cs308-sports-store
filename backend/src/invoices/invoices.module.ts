import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceMailer } from './invoice.mailer.js';
import { createMailTransport, MAIL_TRANSPORT } from './mail.transport.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

/** SCRUM-25 and SCRUM-26. Invoice on screen, as a PDF, and by email. */
@Module({
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceMailer,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: createMailTransport,
    },
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
