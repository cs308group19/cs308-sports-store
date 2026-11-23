import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { formatAmount } from './invoice.format.js';
import { invoicePdfFilename } from './invoice.pdf.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport.js';
import type { InvoiceResponse } from './invoice.types.js';

/** SCRUM-26. Writes the invoice email and hands it to the mail server. Throws when sending fails. */
@Injectable()
export class InvoiceMailer {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async send(invoice: InvoiceResponse, pdf: Buffer): Promise<void> {
    const total = formatAmount(invoice.total, invoice.currency);
    const name = invoice.billedTo.name;
    await this.transport.sendMail({
      from: this.config.get('MAIL_FROM', { infer: true }),
      to: invoice.billedTo.email,
      subject: `Your RALLY invoice ${invoice.invoiceNumber}`,
      text: [
        `Hi ${name},`,
        '',
        `Thank you for your order ${invoice.orderNumber}. We received your payment of ${total}.`,
        `Your invoice ${invoice.invoiceNumber} is attached as a PDF.`,
        '',
        'Returns are accepted within 30 days of delivery.',
        '',
        invoice.seller.name,
      ].join('\n'),
      attachments: [
        {
          filename: invoicePdfFilename(invoice.invoiceNumber),
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
