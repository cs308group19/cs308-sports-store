import type { Request } from 'express';
import type { Profile } from '../generated/prisma/client.js';

/** The signed-in user: their profile row, loaded from the database on every request. */
export type AuthUser = Profile;

export type AuthenticatedRequest = Request & { user?: AuthUser };
