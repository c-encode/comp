import { beforeEach, describe, expect, it, vi } from 'vitest';

// Runs the real task-schedule and policy-schedule jobs against a mocked DB to
// pin WHEN a done task / published policy reopens. reviewDate is the next due
// date, so an item reopens once it has passed — not one period later.

vi.mock('@db/server', () => ({
  db: {
    task: { findMany: vi.fn(), updateMany: vi.fn() },
    policy: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('@trigger.dev/sdk', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  schedules: {
    task: (config: { run: (payload: unknown) => Promise<unknown> }) => config,
  },
}));

vi.mock('@novu/api', () => ({
  Novu: vi.fn().mockImplementation(() => ({ triggerBulk: vi.fn().mockResolvedValue({}) })),
}));

vi.mock('@trycompai/email', () => ({
  isUserUnsubscribed: vi.fn().mockResolvedValue(true),
  TaskStatusNotificationEmail: vi.fn(),
}));

vi.mock('../../lib/send-email-via-api', () => ({
  sendEmailViaApi: vi.fn().mockResolvedValue({}),
}));

import { db } from '@db/server';
import { policySchedule } from './policy-schedule';
import { taskSchedule } from './task-schedule';

const mockDb = db as unknown as {
  task: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  policy: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
};

type Runnable = { run: (payload: unknown) => Promise<unknown> };
const runTaskSchedule = () => (taskSchedule as unknown as Runnable).run({});
const runPolicySchedule = () => (policySchedule as unknown as Runnable).run({});

const NOW = new Date('2027-02-09T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const yesterday = new Date(NOW.getTime() - DAY);
const tomorrow = new Date(NOW.getTime() + DAY);
const org = { id: 'org_1', name: 'Acme', isInternal: false, members: [] };

const doneTask = (id: string, reviewDate: Date, frequency = 'quarterly') => ({
  id,
  title: id,
  status: 'done',
  reviewDate,
  frequency,
  organizationId: org.id,
  organization: org,
  evidenceAutomations: [],
  integrationCheckRuns: [],
  assignee: null,
});

const publishedPolicy = (id: string, reviewDate: Date, frequency = 'yearly') => ({
  id,
  name: id,
  status: 'published',
  reviewDate,
  frequency,
  organizationId: org.id,
  organization: org,
  assignee: null,
});

const reopenedIds = (updateMany: ReturnType<typeof vi.fn>, status: string): string[] =>
  updateMany.mock.calls
    .filter(([arg]) => arg.data.status === status)
    .flatMap(([arg]) => arg.where.id.in as string[]);

describe('review schedules reopen items once reviewDate has passed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers().setSystemTime(NOW);
    mockDb.task.updateMany.mockResolvedValue({ count: 1 });
    mockDb.policy.updateMany.mockResolvedValue({ count: 1 });
  });

  it('task-schedule reopens a quarterly task one day after its review date', async () => {
    mockDb.task.findMany.mockResolvedValue([
      doneTask('tsk_due', yesterday),
      doneTask('tsk_not_yet', tomorrow),
    ]);

    await runTaskSchedule();

    expect(reopenedIds(mockDb.task.updateMany, 'todo')).toEqual(['tsk_due']);
  });

  it('task-schedule leaves done tasks alone when nothing is due', async () => {
    mockDb.task.findMany.mockResolvedValue([doneTask('tsk_not_yet', tomorrow, 'monthly')]);

    await runTaskSchedule();

    expect(mockDb.task.updateMany).not.toHaveBeenCalled();
  });

  it('policy-schedule moves a yearly policy to needs_review one day after its review date', async () => {
    mockDb.policy.findMany.mockResolvedValue([
      publishedPolicy('pol_due', yesterday),
      publishedPolicy('pol_not_yet', tomorrow),
    ]);

    await runPolicySchedule();

    expect(reopenedIds(mockDb.policy.updateMany, 'needs_review')).toEqual(['pol_due']);
  });
});
