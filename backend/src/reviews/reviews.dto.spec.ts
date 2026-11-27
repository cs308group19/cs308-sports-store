import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ModerateReviewDto, SubmitReviewDto } from './reviews.dto.js';

/**
 * SCRUM-61 (regression tests for reviews). The request body is checked before the service runs:
 * a rating is a whole number from 1 to 5, and a comment is optional but never blank.
 */

const valid = { orderItemId: '41', rating: 4 };

/** The properties that failed validation, so each test shows which rule refused the body. */
function failures(body: object): string[] {
  return validateSync(plainToInstance(SubmitReviewDto, body)).map(
    (error) => error.property,
  );
}

describe('SubmitReviewDto rating', () => {
  it.each([1, 2, 3, 4, 5])('accepts %i stars', (rating) => {
    expect(failures({ ...valid, rating })).toEqual([]);
  });

  it.each([
    ['zero stars', 0],
    ['six stars', 6],
    ['a negative rating', -1],
    ['half a star', 2.5],
    ['a rating sent as text', '5'],
    ['no rating', undefined],
    ['a null rating', null],
  ])('refuses %s', (_case, rating) => {
    expect(failures({ ...valid, rating })).toEqual(['rating']);
  });
});

describe('SubmitReviewDto comment', () => {
  it('accepts a rating without a comment', () => {
    expect(failures(valid)).toEqual([]);
  });

  it('trims the comment before it is saved', () => {
    const dto = plainToInstance(SubmitReviewDto, {
      ...valid,
      comment: '  Fits well  ',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.comment).toBe('Fits well');
  });

  it('accepts a comment of exactly 2000 characters', () => {
    expect(failures({ ...valid, comment: 'x'.repeat(2000) })).toEqual([]);
  });

  it.each([
    ['an empty comment', ''],
    ['a comment of only spaces', '   '],
    ['a comment longer than 2000 characters', 'x'.repeat(2001)],
    ['a null comment', null],
    ['a comment that is not text', 5],
  ])('refuses %s', (_case, comment) => {
    expect(failures({ ...valid, comment })).toEqual(['comment']);
  });
});

describe('SubmitReviewDto order item', () => {
  it('refuses a review without an order item', () => {
    expect(failures({ rating: 4 })).toEqual(['orderItemId']);
  });
});

describe('ModerateReviewDto', () => {
  it.each(['approved', 'rejected'])('accepts the decision %s', (status) => {
    expect(
      validateSync(plainToInstance(ModerateReviewDto, { status })),
    ).toEqual([]);
  });

  it.each(['pending', 'APPROVED', 'not_applicable', '', undefined])(
    'refuses the decision %o',
    (status) => {
      const errors = validateSync(
        plainToInstance(ModerateReviewDto, { status }),
      );
      expect(errors.map((error) => error.property)).toEqual(['status']);
    },
  );
});
