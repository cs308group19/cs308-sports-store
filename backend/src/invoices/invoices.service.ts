import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type InvoiceRecord, toInvoiceResponse } from './invoice.mapper.js';
import { InvoiceMailer } from './invoice.mailer.js';
import { buildInvoicePdf, invoicePdfFilename } from './invoice.pdf.js';
import type { InvoiceResponse } from './invoice.types.js';

const NOT_FOUND = 'Invoice not found.';
const MAX_EMAIL_ERROR_LENGTH = 500;

/** What went wrong with an email, in words that are safe to store: no host, port or login. */
export function describeEmailError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;
  let message: string;
  switch (code) {
    case 'ECONNREFUSED':
    case 'ECONNECTION':
    case 'ESOCKET':
    case 'ENOTFOUND':
    case 'EDNS':
      message = 'Could not connect to the mail server.';
      break;
    case 'ETIMEDOUT':
    case 'ECONNECTIONTIMEOUT':
    case 'ESOCKETTIMEDOUT':
      message = 'The mail server did not answer in time.';
      break;
    case 'EAUTH':
      message = 'The mail server rejected the login.';
      break;
    case 'EENVELOPE':
      message = 'The mail server refused the recipient address.';
      break;
    default: {
      const detail =
        error instanceof Error ? (error.message.split('\n')[0] ?? '') : '';
      message = detail
        ? `Email could not be sent: ${detail}`
        : 'Email could not be sent.';
    }
  }
  return (code ? `${message} (${code})` : message).slice(
    0,
    MAX_EMAIL_ERROR_LENGTH,
  );
}

/** Everything an invoice is built from: the invoice, its order, the order lines and the payments. */
const invoiceInclude = {
  user: { select: { email: true } },
  order: {
    include: {
      items: { orderBy: { id: 'asc' as const } },
      payments: { orderBy: { id: 'asc' as const } },
    },
  },
};

/** SCRUM-25. Reads a customer's invoice from the records saved at order time. */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InvoiceMailer) private readonly mailer: InvoiceMailer,
  ) {}

  /**
   * The invoice of one customer. The owner is part of the query itself, so an invoice that belongs
   * to someone else is indistinguishable from one that does not exist: both are 404, never 403.
   */
  async getForUser(
    userId: string,
    invoiceId: bigint,
  ): Promise<InvoiceResponse> {
    const record = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: invoiceInclude,
    });
    if (!record) throw new NotFoundException(NOT_FOUND);
    return toInvoiceResponse(record as InvoiceRecord);
  }

  /**
   * SCRUM-26. The same invoice as a PDF. It goes through getForUser, so the ownership rule is the
   * same: someone else's invoice is a 404.
   */
  async getPdfForUser(
    userId: string,
    invoiceId: bigint,
  ): Promise<{ filename: string; content: Buffer }> {
    const invoice = await this.getForUser(userId, invoiceId);
    return {
      filename: invoicePdfFilename(invoice.invoiceNumber),
      content: await buildInvoicePdf(invoice),
    };
  }

  /**
   * SCRUM-26. Emails the invoice, with its PDF attached, to the customer. Checkout calls this
   * after its transaction has committed. It never throws: a failed email is written to the
   * invoice as email_status = 'failed' with email_error, and the order stays as it is. A success
   * writes email_status = 'sent' and emailed_at.
   */
  async sendInvoiceEmail(invoiceId: bigint | number | string): Promise<void> {
    try {
      const id = BigInt(invoiceId);
      try {
        const record = await this.prisma.invoice.findUnique({
          where: { id },
          include: invoiceInclude,
        });
        if (!record) {
          this.logger.warn(`Invoice ${id} not found, no email sent.`);
          return;
        }
        const invoice = toInvoiceResponse(record as InvoiceRecord);
        if (!invoice.billedTo.email) {
          throw new Error('The customer has no email address.');
        }
        await this.mailer.send(invoice, await buildInvoicePdf(invoice));
        await this.prisma.invoice.update({
          where: { id },
          data: {
            emailStatus: 'sent',
            emailedAt: new Date(),
            emailError: null,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Invoice ${id} email failed: ${describeEmailError(error)}`,
        );
        await this.prisma.invoice.update({
          where: { id },
          data: {
            emailStatus: 'failed',
            emailError: describeEmailError(error),
          },
        });
      }
    } catch (error) {
      // Even recording the failure did not work. Checkout must still go on.
      this.logger.error(
        `Could not record the email result of invoice ${String(invoiceId)}: ${describeEmailError(error)}`,
      );
    }
  }
}
