import { describe, expect, it } from 'vitest';

import { isReviewDue } from './review-due';

describe('isReviewDue', () => {
  const now = new Date('2027-02-08T12:00:00Z');

  it('is due once the stored review date has passed', () => {
    expect(
      isReviewDue({ reviewDate: new Date('2027-02-08T00:00:00Z'), frequency: 'quarterly', now }),
    ).toBe(true);
  });

  it('is due exactly at the review date', () => {
    expect(isReviewDue({ reviewDate: now, frequency: 'monthly', now })).toBe(true);
  });

  it('is not due before the review date', () => {
    expect(
      isReviewDue({ reviewDate: new Date('2027-02-09T00:00:00Z'), frequency: 'quarterly', now }),
    ).toBe(false);
  });

  // Regression: reviewDate is the NEXT due date (set to done-date + one period
  // when a task is completed). Adding another period here reopened quarterly
  // tasks after six months and yearly tasks after two years.
  it('does not add another period on top of the review date', () => {
    const completedOn = new Date('2026-11-08T17:00:00Z');
    const nextDue = new Date('2027-02-08T00:00:00Z'); // completedOn + 3 months
    const justAfterNextDue = new Date('2027-02-08T12:00:00Z');

    expect(isReviewDue({ reviewDate: nextDue, frequency: 'quarterly', now: completedOn })).toBe(
      false,
    );
    expect(
      isReviewDue({ reviewDate: nextDue, frequency: 'quarterly', now: justAfterNextDue }),
    ).toBe(true);
  });

  it('is never due without a review date', () => {
    expect(isReviewDue({ reviewDate: null, frequency: 'yearly', now })).toBe(false);
  });

  it('is never due without a frequency (not a recurring item)', () => {
    expect(
      isReviewDue({ reviewDate: new Date('2020-01-01T00:00:00Z'), frequency: null, now }),
    ).toBe(false);
  });
});
