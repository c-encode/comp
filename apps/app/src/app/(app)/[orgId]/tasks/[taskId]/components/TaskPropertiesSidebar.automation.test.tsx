import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  AUDITOR_PERMISSIONS,
  mockHasPermission,
  setMockPermissions,
} from '@/test-utils/mocks/permissions';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return { ...actual, useParams: vi.fn(() => ({ orgId: 'org_1', taskId: 'tsk_1' })) };
});

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ permissions: {}, hasPermission: mockHasPermission }),
}));

const task = {
  id: 'tsk_1',
  status: 'todo',
  assigneeId: null,
  approverId: null,
  frequency: null,
  department: null,
  reviewDate: null,
  automationStatus: 'MANUAL',
};
vi.mock('../hooks/use-task', () => ({ useTask: () => ({ task, isLoading: false }) }));
vi.mock('@/hooks/use-organization-members', () => ({ useOrganizationMembers: () => ({ members: [] }) }));
vi.mock('@/components/DepartmentSelect', () => ({ DepartmentSelect: () => null }));
vi.mock('@/components/SelectAssignee', () => ({ SelectAssignee: () => null }));
vi.mock('../../components/NotRelevantJustificationDialog', () => ({
  NotRelevantJustificationDialog: () => null,
}));
vi.mock('../../components/TaskStatusIndicator', () => ({ TaskStatusIndicator: () => null }));

// Design-system Select is a Base UI popover that does not open in jsdom; a
// native select keeps the value / onValueChange / disabled contract.
vi.mock('@trycompai/design-system', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Grid: Pass,
    Section: Pass,
    Stack: Pass,
    Text: Pass,
    Label: Pass,
    Input: () => null,
    InputGroup: Pass,
    InputGroupAddon: Pass,
    InputGroupInput: () => null,
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value?: string;
      onValueChange: (v: string) => void;
      disabled?: boolean;
      children: ReactNode;
    }) => (
      <select value={value ?? ''} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    ),
    SelectTrigger: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
      <option value={value}>{typeof children === 'string' ? children : value}</option>
    ),
  };
});

import { TaskPropertiesSidebar } from './TaskPropertiesSidebar';

const automationSelect = () =>
  screen
    .getAllByRole('combobox')
    .find((el) => el.querySelector('option[value="AUTOMATED"]')) as HTMLSelectElement;

describe('TaskPropertiesSidebar automation setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('task:update can switch a manual task to automated', () => {
    setMockPermissions(ADMIN_PERMISSIONS);
    const handleUpdateTask = vi.fn();
    render(<TaskPropertiesSidebar handleUpdateTask={handleUpdateTask} />);

    const select = automationSelect();
    expect(select.value).toBe('MANUAL');
    expect(select.disabled).toBe(false);

    fireEvent.change(select, { target: { value: 'AUTOMATED' } });
    expect(handleUpdateTask).toHaveBeenCalledWith({ automationStatus: 'AUTOMATED' });
  });

  it('read-only users see the setting but cannot change it', () => {
    setMockPermissions(AUDITOR_PERMISSIONS);
    render(<TaskPropertiesSidebar handleUpdateTask={vi.fn()} />);

    expect(automationSelect().disabled).toBe(true);
  });
});
