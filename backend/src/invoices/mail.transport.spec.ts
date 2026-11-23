import { fakeConfig } from '../../test/helpers/test-env.js';
import { createMailTransport } from './mail.transport.js';

/** SCRUM-26. The SMTP settings reach the nodemailer transport. */
describe('createMailTransport', () => {
  const optionsOf = (settings: Record<string, unknown>) =>
    (
      createMailTransport(
        fakeConfig(settings as Record<string, string>),
      ) as unknown as { options: Record<string, unknown> }
    ).options;

  it('talks to a local Mailpit without a login', () => {
    const options = optionsOf({ SMTP_HOST: 'localhost', SMTP_PORT: 1025 });

    expect(options).toMatchObject({
      host: 'localhost',
      port: 1025,
      secure: false,
    });
    expect(options.auth).toBeUndefined();
  });

  it('logs in when a user and a password are set', () => {
    const options = optionsOf({
      SMTP_HOST: 'smtp.ethereal.email',
      SMTP_PORT: 587,
      SMTP_USER: 'user',
      SMTP_PASS: 'secret',
    });

    expect(options.auth).toEqual({ user: 'user', pass: 'secret' });
  });

  it('uses TLS from the start on port 465', () => {
    expect(
      optionsOf({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: 465 }).secure,
    ).toBe(true);
  });

  it('does not wait forever for a mail server', () => {
    const options = optionsOf({ SMTP_HOST: 'localhost', SMTP_PORT: 1025 });

    expect(options.connectionTimeout).toBeLessThanOrEqual(10_000);
    expect(options.socketTimeout).toBeLessThanOrEqual(30_000);
  });
});
