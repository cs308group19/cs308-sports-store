import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestJwt } from './helpers/jwt.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

/** SCRUM-14. GET /api/products/:id through the real guards, pipes and routing. */
describe('Product detail (e2e)', () => {
  let app: INestApplication;
  const prisma = {
    profile: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };

  const row = {
    id: 1n,
    name: 'AeroStride Pro',
    model: 'RLY-2025-01',
    serialNumber: 'R-89741',
    description: 'Lightweight running shoe',
    stockQuantity: 0,
    price: '159.00',
    discountRate: '20.00',
    warrantyStatus: 'active',
    warrantyTerm: '24 months',
    distributor: 'Northstar Athletics',
    imageUrl: null,
    popularity: 98,
    averageRating: '4.80',
    reviewCount: 2,
    category: { name: 'Running', slug: 'running' },
    reviews: [],
  };

  beforeAll(async () => {
    const jwt = await createTestJwt();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JWKS)
      .useValue(jwt.jwks)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(SupabaseAdminService)
      .useValue({ auth: {} })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => prisma.product.findFirst.mockReset());

  it('is open to guests and shows stock and the discounted price', async () => {
    prisma.product.findFirst.mockResolvedValue(row);
    const res = await request(app.getHttpServer())
      .get('/api/products/1')
      .expect(200);
    expect(res.body).toMatchObject({
      id: 1,
      price: 127.2,
      oldPrice: 159,
      stock: 0,
      inStock: false,
      comments: [],
    });
    expect(res.body).not.toHaveProperty('cost');
  });

  it('answers 404 for an unknown product', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/api/products/999').expect(404);
  });

  it('answers 400 for an id that is not a number, without touching the database', async () => {
    await request(app.getHttpServer()).get('/api/products/abc').expect(400);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });
});
