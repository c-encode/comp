import { TaskFrequency } from '@db';
import { computeNextTaskReviewDate } from './task-review-date';

jest.mock('@db', () => ({
  ...jest.requireActual('@prisma/client'),
  db: {},
}));

describe('computeNextTaskReviewDate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 8, 15, 30));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    [TaskFrequency.daily, new Date(2026, 10, 9)],
    [TaskFrequency.weekly, new Date(2026, 10, 15)],
    [TaskFrequency.monthly, new Date(2026, 11, 8)],
    [TaskFrequency.quarterly, new Date(2027, 1, 8)],
    [TaskFrequency.yearly, new Date(2027, 10, 8)],
  ])('%s → one period from today', (frequency, expected) => {
    expect(computeNextTaskReviewDate(frequency)).toEqual(expected);
  });

  it('no frequency → one year', () => {
    expect(computeNextTaskReviewDate(null)).toEqual(new Date(2027, 10, 8));
  });
});
