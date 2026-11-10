'use client';

import { Badge } from '@trycompai/design-system';
import type { CustomDocumentSubmission } from '../hooks/use-custom-documents';

type Status = CustomDocumentSubmission['status'];

const LABELS: Record<Status, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const VARIANTS = {
  pending: 'outline',
  approved: 'default',
  rejected: 'destructive',
} as const satisfies Record<Status, string>;

export function SubmissionStatusBadge({ status }: { status: Status }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
