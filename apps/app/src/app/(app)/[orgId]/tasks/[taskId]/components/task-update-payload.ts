import type { Task } from '@db';

/** Changes the task page's sidebar and header can make to a task. */
export type TaskUpdates = Partial<
  Pick<Task, 'status' | 'assigneeId' | 'approverId' | 'frequency' | 'reviewDate' | 'automationStatus'>
> & {
  department?: string | null;
  notRelevantJustification?: string;
};

/**
 * Maps task-page changes to the PATCH /v1/tasks/:id body. Every field a control
 * can change must be forwarded here, or the control silently does nothing.
 */
export function toUpdateTaskPayload(updates: TaskUpdates) {
  return {
    status: updates.status,
    assigneeId: updates.assigneeId,
    approverId: updates.approverId,
    frequency: updates.frequency,
    department: updates.department,
    reviewDate: updates.reviewDate ? String(updates.reviewDate) : undefined,
    notRelevantJustification: updates.notRelevantJustification,
    automationStatus: updates.automationStatus,
  };
}
