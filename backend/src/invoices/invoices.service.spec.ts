import { NotFoundException } from '@nestjs/common';
import { makeInvoiceRecord } from '../../test/helpers/invoice-fixture.js';
import { describeEmailError, InvoicesService } from './invoices.service.js';

/** SCRUM-26. The email after payment, and what is written on the invoice about it. */
describe('InvoicesService', () => {
  const setup = (
    options: {
      record?: ReturnType<typeof makeInvoiceRecord> | null;
      sendError?: unknown;
      updateError?: unknown;
    } = {},
  ) => {
    const record =
      options.record === undefined ? makeInvoiceRecord() : options.record;
    const prisma = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue(record),
        findUnique: vi.fn().mockResolvedValue(record),
        update: vi
          .fn()
          .mockImplementation(() =>
            options.updateError
              ? Promise.reject(options.updateError)
              : Promise.resolve({}),
          ),
      },
    };
    const mailer = {
      send: vi
        .fn()
        .mockImplementation(() =>
          options.sendError
            ? Promise.reject(options.sendError)
            : Promise.resolve(),
        ),
    };
    const service = new InvoicesService(prisma as never, mailer as never);
    return { service, prisma, mailer };
  };

  describe('sendInvoiceEmail', () => {
    it("writes email_status 'sent' and emailed_at when the email goes out", async () => {
      const { service, prisma, mailer } = setup();

      await service.sendInvoiceEmail(7n);

      expect(mailer.send).toHaveBeenCalledTimes(1);
      expect(prisma.invoice.update).toHaveBeenCalledTimes(1);
      const call = prisma.invoice.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 7n });
      expect(call.data.emailStatus).toBe('sent');
      expect(call.data.emailedAt).toBeInstanceOf(Date);
      expect(call.data.emailError).toBeNull();
    });

    it('sends the PDF of that invoice to the customer', async () => {
      const { service, mailer } = setup();

      await service.sendInvoiceEmail(7n);

      const [invoice, pdf] = mailer.send.mock.calls[0];
      expect(invoice.billedTo.email).toBe('jamie@rally.store');
      expect(invoice.invoiceNumber).toBe('INV-2026-000007');
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it("writes email_status 'failed' and email_error when sending fails, and does not throw", async () => {
      const { service, prisma } = setup({
        sendError: Object.assign(
          new Error('connect ECONNREFUSED 10.1.2.3:1025'),
          {
            code: 'ECONNREFUSED',
          },
        ),
      });

      await expect(service.sendInvoiceEmail(7n)).resolves.toBeUndefined();

      expect(prisma.invoice.update).toHaveBeenCalledTimes(1);
      const { data } = prisma.invoice.update.mock.calls[0][0];
      expect(data.emailStatus).toBe('failed');
      expect(data.emailError).toBe(
        'Could not connect to the mail server. (ECONNREFUSED)',
      );
      expect(data.emailedAt).toBeUndefined();
    });

    it('keeps the mail server address out of the stored error', async () => {
      const { service, prisma } = setup({
        sendError: Object.assign(
          new Error('connect ECONNREFUSED 10.1.2.3:1025'),
          {
            code: 'ECONNREFUSED',
          },
        ),
      });

      await service.sendInvoiceEmail(7n);

      const { data } = prisma.invoice.update.mock.calls[0][0];
      expect(data.emailError).not.toContain('10.1.2.3');
    });

    it('marks the email failed when the customer has no email address', async () => {
      const { service, prisma, mailer } = setup({
        record: makeInvoiceRecord({ user: { email: null } }),
      });

      await service.sendInvoiceEmail(7n);

      expect(mailer.send).not.toHaveBeenCalled();
      const { data } = prisma.invoice.update.mock.calls[0][0];
      expect(data.emailStatus).toBe('failed');
      expect(data.emailError).toContain('no email address');
    });

    it('does not throw when the invoice cannot be loaded, and records the failure', async () => {
      const { service, prisma } = setup();
      prisma.invoice.findUnique.mockRejectedValueOnce(new Error('db down'));

      await expect(service.sendInvoiceEmail(7n)).resolves.toBeUndefined();

      expect(prisma.invoice.update.mock.calls[0][0].data.emailStatus).toBe(
        'failed',
      );
    });

    it('does not throw even when the failure itself cannot be saved', async () => {
      const { service } = setup({
        sendError: new Error('smtp down'),
        updateError: new Error('db down'),
      });

      await expect(service.sendInvoiceEmail(7n)).resolves.toBeUndefined();
    });

    it('does nothing for an invoice that does not exist', async () => {
      const { service, prisma, mailer } = setup({ record: null });

      await expect(service.sendInvoiceEmail(99n)).resolves.toBeUndefined();

      expect(mailer.send).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('accepts the invoice id as text, as the checkout response carries it', async () => {
      const { service, prisma } = setup();

      await service.sendInvoiceEmail('7');

      expect(prisma.invoice.findUnique.mock.calls[0][0].where).toEqual({
        id: 7n,
      });
    });
  });

  describe('getForUser and getPdfForUser', () => {
    it('looks the invoice up together with its owner and answers 404 for no match', async () => {
      const { service, prisma } = setup({ record: null });

      await expect(service.getForUser('customer-2', 7n)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.invoice.findFirst.mock.calls[0][0].where).toEqual({
        id: 7n,
        userId: 'customer-2',
      });
    });

    it('builds the PDF from the same invoice and names it after the number', async () => {
      const { service } = setup();

      const file = await service.getPdfForUser('customer-1', 7n);

      expect(file.filename).toBe('INV-2026-000007.pdf');
      expect(file.content.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('answers 404 for the PDF of an invoice the customer does not own', async () => {
      const { service } = setup({ record: null });

      await expect(
        service.getPdfForUser('customer-2', 7n),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('describeEmailError', () => {
  it.each([
    ['ECONNREFUSED', 'Could not connect to the mail server.'],
    ['ETIMEDOUT', 'The mail server did not answer in time.'],
    ['EAUTH', 'The mail server rejected the login.'],
    ['EENVELOPE', 'The mail server refused the recipient address.'],
  ])('explains %s without the connection details', (code, message) => {
    const error = Object.assign(new Error('smtp.example.com:587 user=bob'), {
      code,
    });
    expect(describeEmailError(error)).toBe(`${message} (${code})`);
  });

  it('keeps the first line of an error without a code, and nothing more', () => {
    expect(describeEmailError(new Error('PDF failed\nstack line'))).toBe(
      'Email could not be sent: PDF failed',
    );
  });

  it('stays short', () => {
    expect(describeEmailError(new Error('x'.repeat(2000))).length).toBe(500);
  });

  it('copes with something that is not an Error', () => {
    expect(describeEmailError('boom')).toBe('Email could not be sent.');
  });
});
