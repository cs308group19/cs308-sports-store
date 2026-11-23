import type { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

/** Injection token for the nodemailer transport, so tests can replace it. */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/** The one thing the invoice mailer needs from a transport. */
export type MailTransport = Pick<Transporter, 'sendMail'>;

/**
 * SMTP transport from SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS. It connects only when a
 * message is sent. The timeouts keep a mail server that never answers from hanging the send.
 */
export function createMailTransport(
  config: ConfigService<Env, true>,
): MailTransport {
  const port = config.get('SMTP_PORT', { infer: true });
  const user = config.get('SMTP_USER', { infer: true });
  const pass = config.get('SMTP_PASS', { infer: true });
  return createTransport({
    host: config.get('SMTP_HOST', { infer: true }),
    port,
    // Port 465 speaks TLS from the first byte. Other ports upgrade with STARTTLS when offered.
    secure: port === 465,
    auth: user !== undefined && pass !== undefined ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}
