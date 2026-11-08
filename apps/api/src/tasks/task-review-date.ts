import { db, type TaskFrequency } from '@db';

/**
 * Next review (due) date for a task completed now. `reviewDate` always holds
 * the NEXT due date; the reopen job brings a done task back once it passes.
 * Every writer of a task's reviewDate on completion must use this.
 *
 * Frequencies are compared as strings (the Prisma enum values) so callers whose
 * tests mock '@db' without the generated enums still work.
 */
export function computeNextTaskReviewDate(
  frequency: TaskFrequency | null | undefined,
): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    case 'weekly':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    case 'quarterly':
      return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    case 'yearly':
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    default:
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
}

/**
 * After a bulk "done", give each task its own next review date from its
 * frequency (one updateMany per frequency), exactly as a single-task update
 * does. `onlyWithoutApprover` mirrors the bulk status update's approval
 * gating, so a task the status update skipped keeps its review date.
 */
export async function setNextReviewDatesForDoneTasks({
  organizationId,
  taskIds,
  onlyWithoutApprover,
}: {
  organizationId: string;
  taskIds: string[];
  onlyWithoutApprover: boolean;
}): Promise<void> {
  const tasks = await db.task.findMany({
    where: {
      id: { in: taskIds },
      organizationId,
      status: 'done',
      ...(onlyWithoutApprover ? { approverId: null } : {}),
    },
    select: { id: true, frequency: true },
  });

  const idsByFrequency = new Map<TaskFrequency | null, string[]>();
  for (const task of tasks) {
    const ids = idsByFrequency.get(task.frequency) ?? [];
    ids.push(task.id);
    idsByFrequency.set(task.frequency, ids);
  }

  for (const [frequency, ids] of idsByFrequency) {
    await db.task.updateMany({
      where: { id: { in: ids }, organizationId },
      data: { reviewDate: computeNextTaskReviewDate(frequency) },
    });
  }
}
