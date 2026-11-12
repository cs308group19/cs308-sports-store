import { randomBytes } from 'node:crypto';
import { fakeConfig } from '../../../test/helpers/test-env.js';
import { FieldEncryptionService } from './field-encryption.service.js';

describe('FieldEncryptionService', () => {
  const service = new FieldEncryptionService(fakeConfig());

  it('round-trips a value', () => {
    expect(service.decrypt(service.encrypt('TR-308-58-991'))).toBe(
      'TR-308-58-991',
    );
  });

  it('round-trips non-ASCII text', () => {
    expect(service.decrypt(service.encrypt('Kadıköy 34000 ✓'))).toBe(
      'Kadıköy 34000 ✓',
    );
  });

  it('never stores the plaintext and tags the format version', () => {
    const encrypted = service.encrypt('TR-308-58-991');
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain('TR-308-58-991');
  });

  it('uses a fresh IV, so the same value encrypts differently each time', () => {
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('detects tampered ciphertext', () => {
    const [version, iv, tag, data] = service.encrypt('secret').split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    expect(() =>
      service.decrypt([version, iv, tag, flipped.toString('base64')].join(':')),
    ).toThrow();
  });

  it('rejects a truncated authentication tag', () => {
    const [version, iv, tag, data] = service.encrypt('secret').split(':');
    const shortTag = Buffer.from(tag, 'base64')
      .subarray(0, 4)
      .toString('base64');
    expect(() =>
      service.decrypt([version, iv, shortTag, data].join(':')),
    ).toThrow(/format/);
  });

  it('cannot be decrypted with another key', () => {
    const other = new FieldEncryptionService(
      fakeConfig({ FIELD_ENCRYPTION_KEY: randomBytes(32).toString('base64') }),
    );
    expect(() => other.decrypt(service.encrypt('secret'))).toThrow();
  });

  it('rejects values in an unknown format', () => {
    expect(() => service.decrypt('plain text')).toThrow(/format/);
    expect(() => service.decrypt('v2:a:b:c')).toThrow(/format/);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(
      () =>
        new FieldEncryptionService(
          fakeConfig({
            FIELD_ENCRYPTION_KEY: randomBytes(8).toString('base64'),
          }),
        ),
    ).toThrow(/32 bytes/);
  });
});
