import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ReviewStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReviewsService } from './reviews.service.js';

const CUSTOMER = 'customer-1';
const ITEM = 41n;
const PRODUCT = 19n;
const REVIEW = 31n;
const saved = {
  id: REVIEW,
  userId: CUSTOMER,
  rating: 4,
  comment: null,
  commentStatus: 'not_applicable',
} as const;

function setup() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: PRODUCT }]),
    orderItem: {
      findFirst: vi.fn().mockResolvedValue({
        orderId: 11n,
        productId: PRODUCT,
        deliveries: [{ id: 8n }],
      }),
    },
    review: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(saved),
      update: vi.fn().mockResolvedValue({
        ...saved,
        comment: 'Fits well',
        commentStatus: 'pending',
      }),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { rating: 3.5 },
        _count: { _all: 2 },
      }),
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    product: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn((work: (transaction: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    review: tx.review,
  };
  return {
    service: new ReviewsService(prisma as unknown as PrismaService),
    tx,
    prisma,
  };
}

describe('ReviewsService', () => {
  it('looks for a delivered item belonging to the customer and skips writes for a missing item', async () => {
    const { service, tx } = setup();
    tx.orderItem.findFirst.mockResolvedValue(null);

    await expect(service.submit(CUSTOMER, ITEM, 4)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.orderItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM, order: { userId: CUSTOMER } },
        select: expect.objectContaining({
          deliveries: expect.objectContaining({
            where: { status: 'delivered' },
          }),
        }),
      }),
    );
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('rejects the review when the customer owns the item but delivery is pending', async () => {
    const { service, tx } = setup();
    tx.orderItem.findFirst.mockResolvedValue({
      orderId: 11n,
      productId: PRODUCT,
      deliveries: [],
    });

    await expect(service.submit(CUSTOMER, ITEM, 4)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('saves an immediate rating and updates product totals within the transaction', async () => {
    const { service, tx, prisma } = setup();

    await expect(service.submit(CUSTOMER, ITEM, 4)).resolves.toEqual({
      id: Number(REVIEW),
      rating: 4,
      commentStatus: null,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
      maxWait: 10_000,
      timeout: 15_000,
    });
    expect(tx.$queryRaw).toHaveBeenCalledBefore(tx.review.findUnique);
    expect(tx.review.create).toHaveBeenCalledBefore(tx.review.aggregate);
    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: CUSTOMER,
          orderItemId: ITEM,
          orderId: 11n,
          productId: PRODUCT,
          rating: 4,
          commentStatus: 'not_applicable',
        }),
      }),
    );
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT },
      data: { averageRating: 3.5, reviewCount: 2 },
    });
  });

  it('submits fresh written comments for approval', async () => {
    const { service, tx } = setup();
    tx.review.create.mockResolvedValue({
      ...saved,
      comment: 'Fits well',
      commentStatus: 'pending',
    });

    await expect(
      service.submit(CUSTOMER, ITEM, 4, 'Fits well'),
    ).resolves.toMatchObject({
      rating: 4,
      commentStatus: 'pending',
    });
    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          comment: 'Fits well',
          commentStatus: 'pending',
        }),
      }),
    );
  });

  it('adds a deferred comment to the existing review without changing the rating totals', async () => {
    const { service, tx } = setup();
    tx.review.findUnique.mockResolvedValue(saved);

    await expect(
      service.submit(CUSTOMER, ITEM, 4, 'Fits well'),
    ).resolves.toEqual({
      id: Number(REVIEW),
      rating: 4,
      commentStatus: 'pending',
    });
    expect(tx.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REVIEW },
        data: {
          comment: 'Fits well',
          commentStatus: 'pending',
          moderatedBy: null,
          moderatedAt: null,
        },
      }),
    );
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  const duplicateCases: Array<
    [string, string, string | null, number, string | undefined]
  > = [
    ['changed rating', CUSTOMER, null, 5, 'Fits well'],
    ['second comment', CUSTOMER, 'First comment', 4, 'Fits well'],
    ['second rating', CUSTOMER, null, 4, undefined],
    ['another author’s review', 'other-customer', null, 4, 'Fits well'],
  ];

  it.each(duplicateCases)(
    'rejects a %s without overwriting the review',
    async (_name, author, existingComment, rating, comment) => {
      const { service, tx } = setup();
      tx.review.findUnique.mockResolvedValue({
        ...saved,
        userId: author,
        comment: existingComment,
      });

      await expect(
        service.submit(CUSTOMER, ITEM, rating, comment),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.review.update).not.toHaveBeenCalled();
      expect(tx.review.create).not.toHaveBeenCalled();
    },
  );

  it('lists written pending comments with the display data the manager uses', async () => {
    const { service, tx } = setup();
    tx.review.findMany.mockResolvedValue([
      {
        id: REVIEW,
        rating: 4,
        comment: 'Fits well',
        product: { name: 'Shirt' },
        user: { fullName: 'Jamie Taylor' },
      },
      { id: REVIEW + 1n, comment: '   ' },
    ]);

    await expect(service.listPending()).resolves.toEqual([
      {
        id: Number(REVIEW),
        rating: 4,
        comment: 'Fits well',
        productName: 'Shirt',
        author: 'Jamie Taylor',
      },
    ]);
    expect(tx.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { commentStatus: 'pending', comment: { not: null } },
      }),
    );
  });

  it('limits a moderation decision to a pending comment and records the decision maker', async () => {
    const { service, tx } = setup();

    await expect(
      service.moderate(REVIEW, 'manager-1', 'approved'),
    ).resolves.toEqual({
      id: Number(REVIEW),
      status: 'approved',
    });
    expect(tx.review.updateMany).toHaveBeenCalledWith({
      where: { id: REVIEW, commentStatus: 'pending', comment: { not: null } },
      data: {
        commentStatus: 'approved',
        moderatedBy: 'manager-1',
        moderatedAt: expect.any(Date),
      },
    });
  });

  const moderationFailures: Array<
    [
      string,
      { comment: string | null; commentStatus: ReviewStatus } | null,
      typeof NotFoundException | typeof ConflictException,
    ]
  > = [
    ['missing review', null, NotFoundException],
    [
      'rating without a comment',
      { comment: null, commentStatus: 'not_applicable' },
      NotFoundException,
    ],
    [
      'previous decision',
      { comment: 'Fits well', commentStatus: 'approved' },
      ConflictException,
    ],
  ];

  it.each(moderationFailures)(
    'handles a %s after a moderation update matches no row',
    async (_name, row, error) => {
      const { service, tx } = setup();
      tx.review.updateMany.mockResolvedValue({ count: 0 });
      tx.review.findUnique.mockResolvedValue(row);

      await expect(
        service.moderate(REVIEW, 'manager-1', 'rejected'),
      ).rejects.toBeInstanceOf(error);
    },
  );
});
