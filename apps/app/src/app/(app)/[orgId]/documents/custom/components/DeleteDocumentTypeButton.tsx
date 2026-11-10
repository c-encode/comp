'use client';

import { apiClient } from '@/lib/api-client';
import { Button } from '@trycompai/design-system';
import { TrashCan } from '@trycompai/design-system/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import {
  CUSTOM_DOCUMENTS_BASE,
  sectionsKey,
  typesKey,
  unwrap,
  type CustomDocumentType,
} from '../hooks/use-custom-documents';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface DeleteDocumentTypeButtonProps {
  organizationId: string;
  documentType: CustomDocumentType;
}

/** Only offered for types without records; the API refuses otherwise. */
export function DeleteDocumentTypeButton({ organizationId, documentType }: DeleteDocumentTypeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      unwrap(await apiClient.delete(`${CUSTOM_DOCUMENTS_BASE}/types/${documentType.id}`, organizationId));
      await Promise.all([mutate(typesKey(organizationId)), mutate(sectionsKey(organizationId))]);
      toast.success('Document type deleted');
      router.push(`/${organizationId}/documents`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the document type');
    }
  };

  return (
    <>
      <Button variant="outline" iconLeft={<TrashCan size={16} />} onClick={() => setOpen(true)}>
        Delete type
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${documentType.title}?`}
        description="The document type is removed from the Documents page. It has no records, so nothing archived is lost."
        onConfirm={handleDelete}
      />
    </>
  );
}
