import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type InvoiceRecord, toInvoiceResponse } from './invoice.mapper.js';
import type { InvoiceResponse } from './invoice.types.js';

const NOT_FOUND = 'Invoice not found.';

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
}
