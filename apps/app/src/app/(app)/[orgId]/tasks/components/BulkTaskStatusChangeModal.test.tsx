import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bulkUpdateStatus = vi.fn();
const bulkSubmitForReview = vi.fn();

vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({ bulkUpdateStatus, bulkSubmitForReview }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/SelectAssignee', () => ({ SelectAssignee: () => null }));

vi.mock('./TaskStatusIndicator', () => ({ TaskStatusIndicator: () => null }));

vi.mock('@trycompai/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

// Radix Select does not open in jsdom; a native select exercises the same
// onValueChange contract.
vi.mock('@trycompai/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select aria-label="status" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value }: { value: string }) => <option value={value}>{value}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

import { BulkTaskStatusChangeModal } from './BulkTaskStatusChangeModal';

describe('BulkTaskStatusChangeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bulkUpdateStatus.mockResolvedValue({ updatedCount: 2 });
  });

  // reviewDate is the next due date; the API sets it per task from frequency.
  // Sending "now" would make every bulk-completed task reopen on the next
  // scheduler run.
  it('marking tasks done does not send a review date', async () => {
    render(
      <BulkTaskStatusChangeModal
        open
        onOpenChange={vi.fn()}
        selectedTaskIds={['tsk_1', 'tsk_2']}
      />,
    );

    fireEvent.change(screen.getByLabelText('status'), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: /move|update|change/i }));

    await waitFor(() => expect(bulkUpdateStatus).toHaveBeenCalledTimes(1));
    expect(bulkUpdateStatus).toHaveBeenCalledWith(['tsk_1', 'tsk_2'], 'done', undefined, undefined);
  });
});
