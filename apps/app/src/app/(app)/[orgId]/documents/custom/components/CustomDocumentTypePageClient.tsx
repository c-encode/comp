'use client';

import { formatSubmissionDate, renderSubmissionValue } from '@/app/(app)/[orgId]/documents/components/submission-utils';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  HStack,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { Add, Edit } from '@trycompai/design-system/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomDocumentSubmissions } from '../hooks/use-custom-documents';
import { DeleteDocumentTypeButton } from './DeleteDocumentTypeButton';
import { SubmissionStatusBadge } from './SubmissionStatusBadge';

interface CustomDocumentTypePageClientProps {
  organizationId: string;
  typeId: string;
}

export function CustomDocumentTypePageClient({ organizationId, typeId }: CustomDocumentTypePageClientProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { data, error, isLoading } = useCustomDocumentSubmissions({ organizationId, typeId });
  const basePath = `/${organizationId}/documents/custom/${typeId}`;

  if (error) {
    return <Text variant="muted">This document type could not be loaded. It may have been deleted.</Text>;
  }
  if (isLoading || !data) {
    return <Text variant="muted">Loading…</Text>;
  }

  const { documentType } = data;
  const submissions = Array.isArray(data.submissions) ? data.submissions : [];
  // The table shows the first two fields; the full record is on the detail page.
  const previewFields = documentType.fields.slice(0, 2);
  const sectionName = documentType.section?.name ?? documentType.builtInCategory ?? '';

  return (
    <Stack gap="6">
      <PageHeader title={documentType.title} />
      <HStack gap="2" wrap="wrap">
        {hasPermission('evidence', 'create') && (
          <Button iconLeft={<Add size={16} />} onClick={() => router.push(`${basePath}/new`)}>
            New record
          </Button>
        )}
        {hasPermission('evidence', 'update') && (
          <Button variant="outline" iconLeft={<Edit size={16} />} onClick={() => router.push(`${basePath}/edit`)}>
            Edit type
          </Button>
        )}
        {hasPermission('evidence', 'delete') && submissions.length === 0 && (
          <DeleteDocumentTypeButton organizationId={organizationId} documentType={documentType} />
        )}
      </HStack>
      <div>
        {documentType.description && <Text variant="muted">{documentType.description}</Text>}
        <Text size="sm" variant="muted">
          Section: {sectionName} · {data.total} record{data.total === 1 ? '' : 's'}
        </Text>
      </div>

      {submissions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No records yet</EmptyTitle>
            <EmptyDescription>
              Records you add here are kept as an archive with their files, date and review status.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {previewFields.map((field) => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                <TableHead>Submitted by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <Link className="text-primary underline" href={`${basePath}/submissions/${submission.id}`}>
                      {formatSubmissionDate(submission.data.submissionDate, submission.submittedAt)}
                    </Link>
                  </TableCell>
                  {previewFields.map((field) => (
                    <TableCell key={field.key}>
                      <div className="max-w-xs truncate">{renderSubmissionValue(submission.data[field.key], field)}</div>
                    </TableCell>
                  ))}
                  <TableCell>{submission.submittedBy?.name ?? submission.submittedBy?.email ?? '—'}</TableCell>
                  <TableCell>
                    <SubmissionStatusBadge status={submission.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Stack>
  );
}
