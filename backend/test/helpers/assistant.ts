/** A stand-in for Gemini and a small catalogue, shared by the assistant's tests. */

export const modelTurn = (...parts: object[]) => ({
  candidates: [{ content: { role: 'model', parts } }],
});

export const says = (text: string) => modelTurn({ text });

export const calls = (name: string, args: object = {}) =>
  modelTurn({ functionCall: { name, args } });

export const geminiResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const productRow = (
  id: number,
  name: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: BigInt(id),
  name,
  model: `MODEL-${id}`,
  serialNumber: `SN-${id}`,
  description: 'A running shoe with soft cushioning.',
  stockQuantity: 5,
  price: '90.00',
  discountRate: '0',
  warrantyStatus: 'active',
  warrantyTerm: '12 months',
  distributor: 'Distributor',
  imageUrl: null,
  popularity: 100 - id,
  averageRating: '0',
  reviewCount: 0,
  category: { name: 'Running', slug: 'running' },
  isActive: true,
  reviews: [],
  ...overrides,
});

export const orderRow = (id: number, userId: string, productName: string) => ({
  id: BigInt(id),
  userId,
  orderNumber: `RLY-2026-${String(id).padStart(6, '0')}`,
  status: 'in_transit',
  totalAmount: '97.20',
  createdAt: new Date(Date.UTC(2026, 10, id)),
  invoice: { id: BigInt(id + 500) },
  items: [
    {
      id: BigInt(id + 900),
      productId: 1n,
      productName,
      productModel: 'MODEL-1',
      quantity: 1,
      unitPricePaid: '90.00',
      lineTotal: '90.00',
      product: { imageUrl: null },
    },
  ],
});

type Where = Record<string, unknown> & {
  id?: bigint;
  isActive?: boolean;
  category?: { slug: string };
};

/** A fake Prisma that honours the filters the shop and order history services send. */
export function fakeStore(
  products: ReturnType<typeof productRow>[],
  orders: ReturnType<typeof orderRow>[] = [],
) {
  const categories = [
    { id: 1n, name: 'Running', slug: 'running', _count: { products: 1 } },
    { id: 2n, name: 'Basketball', slug: 'basketball', _count: { products: 1 } },
  ];
  const matching = (where: Where) =>
    products.filter(
      (row) =>
        (where.id === undefined || row.id === where.id) &&
        (where.isActive === undefined || row.isActive === where.isActive) &&
        (where.category === undefined ||
          row.category.slug === where.category.slug),
    );
  return {
    category: {
      findUnique: vi.fn(({ where }: { where: { slug: string } }) =>
        Promise.resolve(
          categories.find((row) => row.slug === where.slug) ?? null,
        ),
      ),
      findMany: vi.fn(() => Promise.resolve(categories)),
    },
    product: {
      findMany: vi.fn(({ where }: { where: Where }) =>
        Promise.resolve(matching(where)),
      ),
      findFirst: vi.fn(({ where }: { where: Where }) =>
        Promise.resolve(matching(where)[0] ?? null),
      ),
    },
    order: {
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          orders
            .filter((row) => row.userId === where.userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        ),
      ),
    },
  };
}
