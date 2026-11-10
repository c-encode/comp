'use client';

import { apiClient } from '@/lib/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Field,
  FieldError,
  FieldLabel,
  HStack,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Stack,
  Textarea,
} from '@trycompai/design-system';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { mutate } from 'swr';
import {
  CUSTOM_DOCUMENTS_BASE,
  sectionsKey,
  typeKey,
  typesKey,
  unwrap,
  useDocumentSections,
  type CustomDocumentType,
} from '../hooks/use-custom-documents';
import {
  DEFAULT_NEW_FIELDS,
  documentTypeFormSchema,
  toApiPayload,
  toFormValues,
  type DocumentTypeFormValues,
} from '../lib/document-type-form-schema';
import { FieldBuilder } from './FieldBuilder';

interface DocumentTypeFormProps {
  organizationId: string;
  /** Edit this type; omit to create a new one. */
  documentType?: CustomDocumentType;
  /** Preselected placement for a new type, e.g. "section:dsc_1". */
  initialPlacement?: string;
}

export function DocumentTypeForm({
  organizationId,
  documentType,
  initialPlacement,
}: DocumentTypeFormProps) {
  const router = useRouter();
  const { data: sectionsData } = useDocumentSections(organizationId);
  const builtInSections = sectionsData?.builtInSections ?? [];
  const customSections = Array.isArray(sectionsData?.sections) ? sectionsData.sections : [];
  // Maps stored placement values ("section:<id>", "builtin:<name>") to their display names.
  const placementItems = [
    ...customSections.map((section) => ({ value: `section:${section.id}`, label: section.name })),
    ...builtInSections.map((name) => ({ value: `builtin:${name}`, label: name })),
  ];

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocumentTypeFormValues>({
    resolver: zodResolver(documentTypeFormSchema),
    defaultValues: documentType
      ? toFormValues(documentType)
      : {
          title: '',
          description: '',
          placement: initialPlacement ?? '',
          fields: DEFAULT_NEW_FIELDS,
        },
  });

  const handleSave = handleSubmit(async (values) => {
    const payload = toApiPayload({ values, previous: documentType });
    try {
      const saved = unwrap(
        documentType
          ? await apiClient.patch<CustomDocumentType>(
              `${CUSTOM_DOCUMENTS_BASE}/types/${documentType.id}`,
              payload,
              organizationId,
            )
          : await apiClient.post<CustomDocumentType>(
              `${CUSTOM_DOCUMENTS_BASE}/types`,
              payload,
              organizationId,
            ),
      );
      await Promise.all([
        mutate(typesKey(organizationId)),
        mutate(sectionsKey(organizationId)),
        mutate(typeKey({ organizationId, typeId: saved.id })),
      ]);
      toast.success(documentType ? 'Document type updated' : 'Document type created');
      router.push(`/${organizationId}/documents/custom/${saved.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the document type');
    }
  });

  const cancelHref = documentType
    ? `/${organizationId}/documents/custom/${documentType.id}`
    : `/${organizationId}/documents`;

  return (
    <form onSubmit={handleSave} className="flex max-w-3xl flex-col gap-6">
      {documentType && documentType.submissionCount > 0 && (
        <Alert
          variant="warning"
          title="This type already has records"
          description="Field changes apply to new records. Existing records keep their stored values, and values for removed fields still show on each record."
        />
      )}

      <Stack gap="4">
        <Field>
          <FieldLabel htmlFor="type-title">Title</FieldLabel>
          <Controller
            control={control}
            name="title"
            render={({ field: { ref: _ref, ...field } }) => (
              <Input {...field} id="type-title" placeholder="e.g. Architecture & Data Flow Diagram" />
            )}
          />
          <FieldError>{errors.title?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="type-description">Description</FieldLabel>
          <Controller
            control={control}
            name="description"
            render={({ field: { ref: _ref, ...field } }) => (
              <Textarea
                {...field}
                id="type-description"
                rows={2}
                placeholder="What belongs here and how often it is reviewed"
              />
            )}
          />
          <FieldError>{errors.description?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>Section</FieldLabel>
          <Controller
            control={control}
            name="placement"
            render={({ field }) => (
              <Select
                items={placementItems}
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <SelectTrigger aria-label="Section">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {customSections.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Your sections</SelectLabel>
                      {customSections.map((section) => (
                        <SelectItem key={section.id} value={`section:${section.id}`}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>Built-in sections</SelectLabel>
                    {builtInSections.map((name) => (
                      <SelectItem key={name} value={`builtin:${name}`}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          <FieldError>{errors.placement?.message}</FieldError>
        </Field>
      </Stack>

      <FieldBuilder control={control} errors={errors} />

      <HStack gap="2" justify="end">
        <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {documentType ? 'Save changes' : 'Create document type'}
        </Button>
      </HStack>
    </form>
  );
}
