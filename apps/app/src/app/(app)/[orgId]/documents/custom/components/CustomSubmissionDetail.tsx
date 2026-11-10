'use client';

import { formatSubmissionDate, renderSubmissionValue } from '@/app/(app)/[orgId]/documents/components/submission-utils';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { Button, Card, CardContent, HStack, Stack, Text } from '@trycompai/design-system';
import { TrashCan } from '@trycompai/design-system/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import {
  CUSTOM_DOCUMENTS_BASE,
  submissionsKey,
  typesKey,
  unwrap,
  useCustomDocumentSubmission,
} from '../hooks/use-custom-documents';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { ReviewSubmissionControls } from './ReviewSubmissionControls';
import { SubmissionStatusBadge } from './SubmissionStatusBadge';

interface CustomSubmissionDetailProps {
  organizationId: string;
  typeId: string;
  submissionId: string;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 md:grid-cols-[200px_1fr] md:gap-4">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <div className="min-w-0 whitespace-pre-wrap break-words text-sm">{children}</div>
    </div>
  );
}

export function CustomSubmissionDetail({ organizationId, typeId, submissionId }: CustomSubmissionDetailProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, error, isLoading } = useCustomDocumentSubmission({ organizationId, typeId, submissionId });

  if (error) return <Text variant="muted">This record could not be loaded. It may have been deleted.</Text>;
  if (isLoading || !data) return <Text variant="muted">Loading…</Text>;

  const { documentType, submission } = data;

  const handleDelete = async () => {
    try {
      unwrap(
        await apiClient.delete(
          `${CUSTOM_DOCUMENTS_BASE}/types/${typeId}/submissions/${submissionId}`,
          organizationId,
        ),
      );
      await Promise.all([
        mutate(submissionsKey({ organizationId, typeId })),
        mutate(typesKey(organizationId)),
      ]);
      toast.success('Record deleted');
      router.push(`/${organizationId}/documents/custom/${typeId}`);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete the record');
    }
  };

  return (
    <Stack gap="6">
      <HStack gap="2" justify="between" wrap="wrap">
        <SubmissionStatusBadge status={submission.status} />
        {hasPermission('evidence', 'delete') && (
          <Button variant="outline" iconLeft={<TrashCan size={16} />} onClick={() => setDeleteOpen(true)}>
            Delete record
          </Button>
        )}
      </HStack>

      <Card>
        <CardContent>
          <DetailRow label="Document date">
            {formatSubmissionDate(submission.data.submissionDate, submission.submittedAt)}
          </DetailRow>
          {documentType.fields.map((field) => (
            <DetailRow key={field.key} label={field.label}>
              {renderSubmissionValue(submission.data[field.key], field)}
            </DetailRow>
          ))}
          <DetailRow label="Submitted by">
            {submission.submittedBy?.name ?? submission.submittedBy?.email ?? '—'} on{' '}
            {formatSubmissionDate(submission.submittedAt)}
          </DetailRow>
          {submission.reviewedAt && (
            <DetailRow label="Reviewed by">
              {submission.reviewedBy?.name ?? submission.reviewedBy?.email ?? '—'} on{' '}
              {formatSubmissionDate(submission.reviewedAt)}
              {submission.reviewReason ? ` — ${submission.reviewReason}` : ''}
            </DetailRow>
          )}
        </CardContent>
      </Card>

      {submission.status === 'pending' && hasPermission('evidence', 'update') && (
        <ReviewSubmissionControls organizationId={organizationId} typeId={typeId} submissionId={submissionId} />
      )}

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this record?"
        description="The record and its link to the uploaded file are permanently removed from the archive."
        onConfirm={handleDelete}
      />
    </Stack>
  );
}
