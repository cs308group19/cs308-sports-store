import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';

/**
 * Supabase client that uses the secret key. It can create and delete auth users, so it exists
 * only in the backend and must never be sent to the browser.
 */
@Injectable()
export class SupabaseAdminService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService<Env, true>) {
    this.client = createClient(
      config.get('SUPABASE_URL', { infer: true }),
      config.get('SUPABASE_SECRET_KEY', { infer: true }),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  get auth() {
    return this.client.auth.admin;
  }
}
