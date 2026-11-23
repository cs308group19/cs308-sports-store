import { makeInvoiceRecord } from '../../test/helpers/invoice-fixture.js';
import { fakeConfig } from '../../test/helpers/test-env.js';
import { toInvoiceResponse } from './invoice.mapper.js';
import { InvoiceMailer } from './invoice.mailer.js';

/** SCRUM-26. The email that carries the invoice PDF. */
describe('InvoiceMailer', () => {
  const invoice = toInvoiceResponse(makeInvoiceRecord());
  const pdf = Buffer.from('%PDF-1.3 test');
  const config = fakeConfig({ MAIL_FROM: 'RALLY <no-reply@rally.store>' });

  it('sends the PDF to the customer from the configured sender', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue({}) };

    await new InvoiceMailer(transport as never, config).send(invoice, pdf);

    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    const message = transport.sendMail.mock.calls[0][0];
    expect(message.from).toBe('RALLY <no-reply@rally.store>');
    expect(message.to).toBe('jamie@rally.store');
    expect(message.subject).toBe('Your RALLY invoice INV-2026-000007');
    expect(message.text).toContain('RLY-2026-000042');
    expect(message.text).toContain('$236.52');
    expect(message.attachments).toEqual([
      {
        filename: 'INV-2026-000007.pdf',
        content: pdf,
        contentType: 'application/pdf',
      },
    ]);
  });

  it('lets the error of the mail server through, for the service to record', async () => {
    const transport = {
      sendMail: vi.fn().mockRejectedValue(new Error('refused')),
    };

    await expect(
      new InvoiceMailer(transport as never, config).send(invoice, pdf),
    ).rejects.toThrow('refused');
  });
});
