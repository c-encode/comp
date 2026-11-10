'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Text,
} from '@trycompai/design-system';
import { OverflowMenuVertical } from '@trycompai/design-system/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import { CUSTOM_DOCUMENTS_BASE, sectionsKey, unwrap, type DocumentSection } from '../hooks/use-custom-documents';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { SectionDialog } from './SectionDialog';

interface DocumentSectionHeadingProps {
  organizationId: string;
  name: string;
  count: number;
  /** Placement value for "Add document type here", e.g. "builtin:Security". */
  placement: string;
  customSection: DocumentSection | null;
}

export function DocumentSectionHeading({
  organizationId,
  name,
  count,
  placement,
  customSection,
}: DocumentSectionHeadingProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canCreate = hasPermission('evidence', 'create');
  const canRename = !!customSection && hasPermission('evidence', 'update');
  const canDelete = !!customSection && count === 0 && hasPermission('evidence', 'delete');

  const handleDelete = async () => {
    if (!customSection) return;
    try {
      unwrap(await apiClient.delete(`${CUSTOM_DOCUMENTS_BASE}/sections/${customSection.id}`, organizationId));
      await mutate(sectionsKey(organizationId));
      toast.success('Section deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the section');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Text size="lg" weight="semibold">
        {name}
      </Text>
      <Badge variant="secondary">{count}</Badge>
      {(canCreate || canRename || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={`${name} section actions`} />}
          >
            <OverflowMenuVertical size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {canCreate && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(
                    `/${organizationId}/documents/custom/new?placement=${encodeURIComponent(placement)}`,
                  )
                }
              >
                Add document type here
              </DropdownMenuItem>
            )}
            {canRename && <DropdownMenuItem onClick={() => setRenameOpen(true)}>Rename section</DropdownMenuItem>}
            {canDelete && <DropdownMenuItem onClick={() => setDeleteOpen(true)}>Delete section</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {customSection && (
        <>
          <SectionDialog
            organizationId={organizationId}
            open={renameOpen}
            onOpenChange={setRenameOpen}
            section={customSection}
          />
          <ConfirmDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`Delete the ${name} section?`}
            description="The section is empty, so no document types or records are affected."
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
