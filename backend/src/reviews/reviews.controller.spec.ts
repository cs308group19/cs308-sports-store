import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../auth/auth.types.js';
import { ROLES_KEY } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';
import { ReviewsController } from './reviews.controller.js';
import type { ReviewsService } from './reviews.service.js';
import { StaffReviewsController } from './staff-reviews.controller.js';

/**
 * SCRUM-61 (regression tests for reviews). Who may call each review route, and that a bad order
 * item or review id is refused before the service (and the database) is reached.
 */

const reviews = {
  submit: vi.fn(),
  listPending: vi.fn(),
  moderate: vi.fn(),
};
const service = reviews as unknown as ReviewsService;
const customerRoutes = new ReviewsController(service);
const staffRoutes = new StaffReviewsController(service);

const customer = { id: 'customer-1' } as AuthUser;
const manager = { id: 'manager-1' } as AuthUser;

beforeEach(() => {
  vi.resetAllMocks();
  reviews.submit.mockResolvedValue({ id: 31, rating: 4, commentStatus: null });
  reviews.listPending.mockResolvedValue([]);
  reviews.moderate.mockResolvedValue({ id: 31, status: 'approved' });
});

describe('who may use the review routes', () => {
  it('lets only customers rate and comment', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ReviewsController)).toEqual([
      UserRole.customer,
    ]);
  });

  it('lets only product managers see and moderate comments', () => {
    expect(Reflect.getMetadata(ROLES_KEY, StaffReviewsController)).toEqual([
      UserRole.product_manager,
    ]);
  });
});

describe('ReviewsController.submit', () => {
  it('reviews as the signed-in customer, never as an id from the body', async () => {
    await customerRoutes.submit(customer, {
      orderItemId: '41',
      rating: 5,
      comment: 'Fits well',
    });

    expect(reviews.submit).toHaveBeenCalledWith(
      'customer-1',
      41n,
      5,
      'Fits well',
    );
  });

  it('accepts the order item id as a number too', async () => {
    await customerRoutes.submit(customer, { orderItemId: 41, rating: 3 });

    expect(reviews.submit).toHaveBeenCalledWith(
      'customer-1',
      41n,
      3,
      undefined,
    );
  });

  it('keeps an order item id above the safe JavaScript range exactly', async () => {
    await customerRoutes.submit(customer, {
      orderItemId: '9007199254740993',
      rating: 4,
    });

    expect(reviews.submit).toHaveBeenCalledWith(
      'customer-1',
      9007199254740993n,
      4,
      undefined,
    );
  });

  it.each([
    ['zero', '0'],
    ['a negative id', '-4'],
    ['a decimal', '4.5'],
    ['text', 'abc'],
    ['a number too large for JavaScript', Number.MAX_SAFE_INTEGER + 1],
    ['a decimal number', 4.5],
    ['an id too large for PostgreSQL', '9223372036854775808'],
    ['an object', { id: 41 }],
    ['null', null],
  ])('refuses %s as the order item id', (_case, orderItemId) => {
    expect(() =>
      customerRoutes.submit(customer, { orderItemId, rating: 4 }),
    ).toThrow(BadRequestException);
    expect(reviews.submit).not.toHaveBeenCalled();
  });
});

describe('StaffReviewsController.list', () => {
  it.each([undefined, 'pending'])(
    'lists pending comments for status %o',
    async (status) => {
      await staffRoutes.list(status);

      expect(reviews.listPending).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['approved', 'rejected', '', ['pending']])(
    'refuses the status filter %o',
    (status) => {
      expect(() => staffRoutes.list(status)).toThrow(BadRequestException);
      expect(reviews.listPending).not.toHaveBeenCalled();
    },
  );
});

describe('StaffReviewsController.moderate', () => {
  it('records the signed-in manager as the one who decided', async () => {
    await staffRoutes.moderate('31', manager, { status: 'rejected' });

    expect(reviews.moderate).toHaveBeenCalledWith(31n, 'manager-1', 'rejected');
  });

  it.each(['0', '-1', 'abc', '3.5'])(
    'refuses the review id %s before moderating',
    (id) => {
      expect(() =>
        staffRoutes.moderate(id, manager, { status: 'approved' }),
      ).toThrow(BadRequestException);
      expect(reviews.moderate).not.toHaveBeenCalled();
    },
  );
});
