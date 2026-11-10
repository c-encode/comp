'use client';

import { formatSubmissionDate } from '@/app/(app)/[orgId]/documents/components/submission-utils';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Text } from '@trycompai/design-system';
import Link from 'next/link';
import type { CustomDocumentType } from '../hooks/use-custom-documents';

export function CustomDocumentCard({
  organizationId,
  documentType,
}: {
  organizationId: string;
  documentType: CustomDocumentType;
}) {
  const count = documentType.submissionCount;
  return (
    <Link href={`/${organizationId}/documents/custom/${documentType.id}`}>
      <Card>
        <CardHeader>
          <CardTitle>{documentType.title}</CardTitle>
          <div className="line-clamp-1">
            <CardDescription>{documentType.description || 'Custom document type'}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">Custom</Badge>
            {count === 0 ? (
              <Badge variant="outline">No records</Badge>
            ) : (
              <Text size="xs" variant="muted">
                {count} record{count === 1 ? '' : 's'} · last added{' '}
                {formatSubmissionDate(documentType.lastSubmittedAt)}
              </Text>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
