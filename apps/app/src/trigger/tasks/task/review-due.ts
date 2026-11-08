/**
 * Whether a recurring task or policy is due for review.
 *
 * `reviewDate` holds the NEXT due date: the API sets it to completion date +
 * one period when a task is marked done or a policy is published. It is due
 * once that date has passed. Do not add another period here: that counted the
 * period twice (quarterly items came back after six months).
 */
export const isReviewDue = ({
  reviewDate,
  frequency,
  now,
}: {
  reviewDate: Date | null;
  frequency: string | null;
  now: Date;
}): boolean => {
  if (!reviewDate || !frequency) return false;
  return reviewDate.getTime() <= now.getTime();
};
