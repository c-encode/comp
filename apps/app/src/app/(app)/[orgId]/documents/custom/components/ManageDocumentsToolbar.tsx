'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { Button, HStack } from '@trycompai/design-system';
import { Add } from '@trycompai/design-system/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SectionDialog } from './SectionDialog';

export function ManageDocumentsToolbar({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [sectionOpen, setSectionOpen] = useState(false);

  if (!hasPermission('evidence', 'create')) return null;

  return (
    <>
      <HStack gap="2" justify="end" wrap="wrap">
        <Button variant="outline" iconLeft={<Add size={16} />} onClick={() => setSectionOpen(true)}>
          New section
        </Button>
        <Button
          iconLeft={<Add size={16} />}
          onClick={() => router.push(`/${organizationId}/documents/custom/new`)}
        >
          New document type
        </Button>
      </HStack>
      <SectionDialog organizationId={organizationId} open={sectionOpen} onOpenChange={setSectionOpen} />
    </>
  );
}
