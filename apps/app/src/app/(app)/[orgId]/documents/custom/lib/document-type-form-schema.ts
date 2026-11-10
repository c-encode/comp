import { z } from 'zod';
import type { CustomDocumentField, CustomDocumentType } from '../hooks/use-custom-documents';
import { toFieldKey } from './field-keys';

export const FIELD_TYPE_OPTIONS = [
  { value: 'file', label: 'File upload' },
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
] as const;

const fieldFormSchema = z
  .object({
    // Empty for fields added in this edit; filled in from the label on save.
    key: z.string(),
    label: z.string().trim().min(1, 'Label is required').max(200),
    type: z.enum(['text', 'textarea', 'date', 'select', 'file']),
    required: z.boolean(),
    description: z.string().max(1000),
    // Dropdown options, one per line.
    optionsText: z.string(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'select' && splitOptions(field.optionsText).length === 0) {
      ctx.addIssue({ code: 'custom', path: ['optionsText'], message: 'Add at least one option' });
    }
  });

export const documentTypeFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(2000),
  /** "builtin:<name>" or "section:<id>" */
  placement: z.string().min(1, 'Choose a section'),
  fields: z.array(fieldFormSchema).min(1, 'Add at least one field').max(40),
});

export type DocumentTypeFormValues = z.infer<typeof documentTypeFormSchema>;
export type FieldFormValues = DocumentTypeFormValues['fields'][number];

export function splitOptions(optionsText: string): string[] {
  return Array.from(
    new Set(
      optionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );
}

export function emptyField(type: FieldFormValues['type'] = 'text'): FieldFormValues {
  return { key: '', label: '', type, required: false, description: '', optionsText: '' };
}

/** Sensible starting point for an archive-style document: a file plus notes. */
export const DEFAULT_NEW_FIELDS: FieldFormValues[] = [
  { ...emptyField('file'), label: 'Document', required: true },
  { ...emptyField('textarea'), label: 'Notes' },
];

export function toFormValues(type: CustomDocumentType): DocumentTypeFormValues {
  return {
    title: type.title,
    description: type.description,
    placement: type.sectionId ? `section:${type.sectionId}` : `builtin:${type.builtInCategory ?? ''}`,
    fields: type.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      description: field.description ?? '',
      optionsText: (field.options ?? []).map((option) => option.label).join('\n'),
    })),
  };
}

/**
 * Convert form values into the API payload, assigning keys to new fields.
 * Dropdown options keep their stored value when the label is unchanged, so
 * types created through the API with value != label stay readable.
 */
export function toApiPayload(params: {
  values: DocumentTypeFormValues;
  previous?: CustomDocumentType;
}) {
  const { values } = params;
  const previousOptionValue = new Map<string, string>();
  for (const field of params.previous?.fields ?? []) {
    for (const option of field.options ?? []) {
      previousOptionValue.set(`${field.key}\u0000${option.label}`, option.value);
    }
  }
  const existingKeys = values.fields.map((field) => field.key).filter(Boolean);
  const fields: CustomDocumentField[] = [];

  for (const field of values.fields) {
    const key = field.key || toFieldKey({ label: field.label, existingKeys });
    if (!field.key) existingKeys.push(key);

    const description = field.description.trim();
    fields.push({
      key,
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      ...(description ? { description } : {}),
      ...(field.type === 'select'
        ? {
            options: splitOptions(field.optionsText).map((label) => ({
              label,
              value: previousOptionValue.get(`${key}\u0000${label}`) ?? label,
            })),
          }
        : {}),
    });
  }

  const [kind, ...rest] = values.placement.split(':');
  const target = rest.join(':');
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    sectionId: kind === 'section' ? target : null,
    builtInCategory: kind === 'builtin' ? target : null,
    fields,
  };
}
