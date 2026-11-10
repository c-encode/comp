'use client';

import { apiClient } from '@/lib/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from '@trycompai/design-system';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { mutate } from 'swr';
import { z } from 'zod';
import {
  CUSTOM_DOCUMENTS_BASE,
  sectionsKey,
  typesKey,
  unwrap,
  type DocumentSection,
} from '../hooks/use-custom-documents';

const sectionFormSchema = z.object({
  name: z.string().trim().min(1, 'Section name is required').max(100),
});

type SectionFormValues = z.infer<typeof sectionFormSchema>;

interface SectionDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rename this section; omit to create a new one. */
  section?: DocumentSection | null;
}

export function SectionDialog({ organizationId, open, onOpenChange, section }: SectionDialogProps) {
  const isRename = !!section;
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SectionFormValues>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: { name: section?.name ?? '' },
  });

  useEffect(() => {
    if (open) reset({ name: section?.name ?? '' });
  }, [open, section, reset]);

  const handleSave = handleSubmit(async (values) => {
    try {
      if (section) {
        unwrap(
          await apiClient.patch(
            `${CUSTOM_DOCUMENTS_BASE}/sections/${section.id}`,
            values,
            organizationId,
          ),
        );
      } else {
        unwrap(await apiClient.post(`${CUSTOM_DOCUMENTS_BASE}/sections`, values, organizationId));
      }
      await Promise.all([mutate(sectionsKey(organizationId)), mutate(typesKey(organizationId))]);
      toast.success(isRename ? 'Section renamed' : 'Section created');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the section');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isRename ? 'Rename section' : 'New section'}</DialogTitle>
            <DialogDescription>
              Sections group document types on the Documents page.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="section-name">Name</FieldLabel>
            <Controller
              control={control}
              name="name"
              render={({ field: { ref: _ref, ...field } }) => (
                <Input {...field} id="section-name" placeholder="e.g. Architecture" autoFocus />
              )}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isRename ? 'Save' : 'Create section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
