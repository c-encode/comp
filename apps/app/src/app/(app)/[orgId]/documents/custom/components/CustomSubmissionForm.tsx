'use client';

import { apiClient } from '@/lib/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  HStack,
  Input,
  Stack,
} from '@trycompai/design-system';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { mutate } from 'swr';
import {
  CUSTOM_DOCUMENTS_BASE,
  submissionsKey,
  typesKey,
  unwrap,
  type CustomDocumentType,
} from '../hooks/use-custom-documents';
import {
  buildSubmissionFormSchema,
  emptySubmissionValues,
  toSubmissionPayload,
  type SubmissionFormValues,
} from '../lib/submission-form-schema';
import { CustomFieldInput } from './CustomFieldInput';

interface CustomSubmissionFormProps {
  organizationId: string;
  documentType: CustomDocumentType;
}

function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return undefined;
}

export function CustomSubmissionForm({ organizationId, documentType }: CustomSubmissionFormProps) {
  const router = useRouter();
  const schema = useMemo(() => buildSubmissionFormSchema(documentType.fields), [documentType.fields]);
  const typeHref = `/${organizationId}/documents/custom/${documentType.id}`;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptySubmissionValues(documentType.fields),
  });

  const handleSave = handleSubmit(async (values) => {
    try {
      unwrap(
        await apiClient.post(
          `${CUSTOM_DOCUMENTS_BASE}/types/${documentType.id}/submissions`,
          { data: toSubmissionPayload(values) },
          organizationId,
        ),
      );
      await Promise.all([
        mutate(submissionsKey({ organizationId, typeId: documentType.id })),
        mutate(typesKey(organizationId)),
      ]);
      toast.success('Record saved');
      router.push(typeHref);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the record');
    }
  });

  return (
    <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-6">
      <Stack gap="4">
        <Field>
          <FieldLabel htmlFor="submission-date">Document date</FieldLabel>
          <Controller
            control={control}
            name="submissionDate"
            render={({ field }) => (
              <Input
                id="submission-date"
                type="date"
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
          <FieldDescription>The date this record is for, e.g. when the diagram was approved.</FieldDescription>
          <FieldError>{errorMessage(errors.submissionDate)}</FieldError>
        </Field>

        {documentType.fields.map((definition) => {
          const id = `custom-field-${definition.key}`;
          return (
            <Field key={definition.key}>
              <FieldLabel htmlFor={id}>
                {definition.label}
                {definition.required ? ' *' : ''}
              </FieldLabel>
              <Controller
                control={control}
                name={definition.key}
                render={({ field }) => (
                  <CustomFieldInput
                    organizationId={organizationId}
                    typeId={documentType.id}
                    field={definition}
                    id={id}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {definition.description && <FieldDescription>{definition.description}</FieldDescription>}
              <FieldError>{errorMessage(errors[definition.key])}</FieldError>
            </Field>
          );
        })}
      </Stack>

      <HStack gap="2" justify="end">
        <Button type="button" variant="outline" onClick={() => router.push(typeHref)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save record
        </Button>
      </HStack>
    </form>
  );
}
