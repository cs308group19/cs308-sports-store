import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { FieldEncryptionService } from '../src/common/crypto/field-encryption.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

describe('Authentication and role protection (e2e)', () => {
  let app: INestApplication;
  let jwt: Awaited<ReturnType<typeof createTestJwt>>;
  const profiles = new Map<string, ReturnType<typeof makeProfile>>();
  const prisma = {
    profile: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          profiles.get(where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: object }) => makeProfile(data)),
    },
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };
  const createUser = vi.fn();
  const deleteUser = vi.fn();
  let encryption: InstanceType<typeof FieldEncryptionService>;

  const bearer = async (id: string) => `Bearer ${await jwt.sign({ sub: id })}`;

  beforeAll(async () => {
    jwt = await createTestJwt();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JWKS)
      .useValue(jwt.jwks)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(SupabaseAdminService)
      .useValue({ auth: { createUser, deleteUser } })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    encryption = app.get(FieldEncryptionService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    profiles.clear();
    createUser.mockReset();
    deleteUser.mockReset();
    prisma.profile.create.mockClear();
    profiles.set(
      'customer-1',
      makeProfile({ id: 'customer-1', role: 'customer', taxIdEncrypted: null }),
    );
    profiles.set(
      'product-1',
      makeProfile({ id: 'product-1', role: 'product_manager' }),
    );
    profiles.set(
      'sales-1',
      makeProfile({ id: 'sales-1', role: 'sales_manager' }),
    );
    profiles.set(
      'support-1',
      makeProfile({ id: 'support-1', role: 'support_agent' }),
    );
  });

  it('serves the public health check without a token', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' });
  });

  it('rejects /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('rejects /auth/me with a garbage token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer nonsense')
      .expect(401);
  });

  it('returns the profile of the signed-in user, including the decrypted tax ID', async () => {
    profiles.set(
      'customer-1',
      makeProfile({
        id: 'customer-1',
        taxIdEncrypted: encryption.encrypt('TR-308-58-991'),
      }),
    );
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', await bearer('customer-1'))
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'customer-1',
      role: 'customer',
      taxId: 'TR-308-58-991',
    });
  });

  it('rejects a valid token whose user has no profile', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', await bearer('ghost'))
      .expect(401);
  });

  describe.each([
    ['product-manager', 'product-1'],
    ['sales-manager', 'sales-1'],
    ['support-agent', 'support-1'],
  ])('GET /api/staff/%s', (area, ownerId) => {
    it('is open to its own role', async () => {
      await request(app.getHttpServer())
        .get(`/api/staff/${area}`)
        .set('Authorization', await bearer(ownerId))
        .expect(200);
    });

    it('is closed to a customer', async () => {
      await request(app.getHttpServer())
        .get(`/api/staff/${area}`)
        .set('Authorization', await bearer('customer-1'))
        .expect(403);
    });

    it('is closed to every other staff role', async () => {
      for (const other of ['product-1', 'sales-1', 'support-1'].filter(
        (id) => id !== ownerId,
      )) {
        await request(app.getHttpServer())
          .get(`/api/staff/${area}`)
          .set('Authorization', await bearer(other))
          .expect(403);
      }
    });

    it('requires a token', async () => {
      await request(app.getHttpServer()).get(`/api/staff/${area}`).expect(401);
    });
  });

  it('applies a role change on the very next request, without a new token', async () => {
    const token = await bearer('customer-1');
    await request(app.getHttpServer())
      .get('/api/staff/sales-manager')
      .set('Authorization', token)
      .expect(403);

    profiles.set(
      'customer-1',
      makeProfile({ id: 'customer-1', role: 'sales_manager' }),
    );

    await request(app.getHttpServer())
      .get('/api/staff/sales-manager')
      .set('Authorization', token)
      .expect(200);
  });

  describe('POST /api/auth/register', () => {
    const body = {
      fullName: 'Alex Morgan',
      taxId: 'TR-308-58-991',
      email: 'Alex@Example.com',
      homeAddress: '12 Main Street, Istanbul',
      password: 'Rally1234',
    };

    it('creates a customer and returns no secrets', async () => {
      createUser.mockResolvedValue({
        data: { user: { id: 'new-user' } },
        error: null,
      });

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(body)
        .expect(201);

      expect(response.body).toEqual({
        id: 'new-user',
        email: 'alex@example.com',
        role: 'customer',
      });
      const stored = prisma.profile.create.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(stored.role).toBe('customer');
      expect(String(stored.taxIdEncrypted)).toMatch(/^v1:/);
    });

    it('rejects an attempt to choose a role', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...body, role: 'sales_manager' })
        .expect(400);
      expect(createUser).not.toHaveBeenCalled();
    });

    it('rejects a weak password before talking to Supabase', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...body, password: 'password' })
        .expect(400);
      expect(createUser).not.toHaveBeenCalled();
    });

    it('answers 409 for an email that is already registered', async () => {
      createUser.mockResolvedValue({
        data: { user: null },
        error: { code: 'email_exists', message: 'x' },
      });
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(body)
        .expect(409);
    });

    // Keep this last in the describe: it uses up the per-IP registration budget.
    it('rate limits repeated registration attempts', async () => {
      createUser.mockResolvedValue({
        data: { user: null },
        error: { code: 'email_exists', message: 'x' },
      });
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 8; attempt++) {
        statuses.push(
          (
            await request(app.getHttpServer())
              .post('/api/auth/register')
              .send(body)
          ).status,
        );
      }
      expect(statuses).toContain(429);
    });
  });
});
