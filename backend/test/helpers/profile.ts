import type { Profile } from '../../src/generated/prisma/client.js';

export const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  email: 'jamie@rally.store',
  fullName: 'Jamie Taylor',
  taxIdEncrypted: null,
  homeAddress: '123 Fast Lane, Istanbul',
  role: 'customer',
  createdAt: new Date('2026-11-12T00:00:00Z'),
  updatedAt: new Date('2026-11-12T00:00:00Z'),
  ...overrides,
});
