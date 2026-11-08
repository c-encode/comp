import { describe, expect, it } from 'vitest';

import { toUpdateTaskPayload } from './task-update-payload';

describe('toUpdateTaskPayload', () => {
  // Fields the sidebar changes must reach PATCH /v1/tasks/:id; a field left
  // out here does nothing at runtime even though the control appears to work.
  it('forwards automationStatus', () => {
    expect(toUpdateTaskPayload({ automationStatus: 'AUTOMATED' }).automationStatus).toBe(
      'AUTOMATED',
    );
  });

  it('forwards the existing sidebar fields', () => {
    expect(
      toUpdateTaskPayload({
        status: 'done',
        assigneeId: 'mem_1',
        approverId: null,
        frequency: 'monthly',
        department: 'it',
        notRelevantJustification: 'n/a',
      }),
    ).toEqual({
      status: 'done',
      assigneeId: 'mem_1',
      approverId: null,
      frequency: 'monthly',
      department: 'it',
      reviewDate: undefined,
      notRelevantJustification: 'n/a',
      automationStatus: undefined,
    });
  });

  it('serialises reviewDate to a string', () => {
    const date = new Date('2027-02-08T00:00:00.000Z');
    expect(toUpdateTaskPayload({ reviewDate: date }).reviewDate).toBe(String(date));
  });
});
