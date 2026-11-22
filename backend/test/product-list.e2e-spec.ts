import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestJwt } from './helpers/jwt.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

/** SCRUM-13. GET /api/products and GET /api/categories through the real guards and routing. */
describe('Product list (e2e)', () => {
  let app: INestApplication;
  const prisma = {
    profile: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), findFirst: vi.fn() },
    category: { findUnique: vi.fn(), findMany: vi.fn() },
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };

  const row = {
    id: 1n,
    name: 'AeroStride Pro',
    model: 'RLY-2025-01',
    serialNumber: 'R-89741',
    description: 'Lightweight running shoe',
    stockQuantity: 14,
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

  beforeEach(() => {
    prisma.product.findMany.mockReset();
    prisma.product.findFirst.mockReset();
    prisma.category.findUnique.mockReset();
    prisma.category.findMany.mockReset();
  });

  it('lists products for guests without the cost', async () => {
    prisma.product.findMany.mockResolvedValue([row]);
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: 1,
      category: 'Running',
      categorySlug: 'running',
      price: 127.2,
      oldPrice: 159,
      stock: 14,
      inStock: true,
    });
    expect(res.body[0]).not.toHaveProperty('cost');
    expect(res.body[0]).not.toHaveProperty('comments');
  });

  it('filters by category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 2n });
    prisma.product.findMany.mockResolvedValue([row]);
    await request(app.getHttpServer())
      .get('/api/products?category=running')
      .expect(200);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, category: { slug: 'running' } },
      }),
    );
  });

  it('answers 404 for an unknown category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/products?category=curling')
      .expect(404);
  });

  it('answers 400 for a malformed category, without touching the database', async () => {
    await request(app.getHttpServer())
      .get('/api/products?category=Not%20A%20Slug')
      .expect(400);
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('does not route /api/products to the detail endpoint', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/api/products').expect(200);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it('lists categories with product counts for guests', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 2n, name: 'Running', slug: 'running', _count: { products: 4 } },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/categories')
      .expect(200);
    expect(res.body).toEqual([
      { id: 2, name: 'Running', slug: 'running', productCount: 4 },
    ]);
  });
});
