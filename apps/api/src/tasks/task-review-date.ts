import { db, TaskFrequency, TaskStatus } from '@db';

/**
 * Next review (due) date for a task completed now. `reviewDate` always holds
 * the NEXT due date; the reopen job brings a done task back once it passes.
 */
export function computeNextTaskReviewDate(
  frequency: TaskFrequency | null | undefined,
): Date {
  const now = new Date();
  switch (frequency) {
    case TaskFrequency.daily:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    case TaskFrequency.weekly:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    case TaskFrequency.monthly:
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    case TaskFrequency.quarterly:
      return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    case TaskFrequency.yearly:
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    default:
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
}

/**
 * After a bulk "done", give each task its own next review date from its
 * frequency (one updateMany per frequency). Tasks without a frequency are not
 * recurring and get no review date.
 */
export async function setNextReviewDatesForDoneTasks({
  organizationId,
  taskIds,
}: {
  organizationId: string;
  taskIds: string[];
}): Promise<void> {
  const tasks = await db.task.findMany({
    where: { id: { in: taskIds }, organizationId, status: TaskStatus.done },
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
      data: {
        reviewDate: frequency ? computeNextTaskReviewDate(frequency) : null,
      },
    });
  }
}
