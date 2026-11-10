import { z } from 'zod';
import type { CustomDocumentField } from '../hooks/use-custom-documents';

const fileValueSchema = z.object({
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
  downloadUrl: z.string().min(1),
});

function valueSchema(field: CustomDocumentField): z.ZodType {
  const message = `${field.label} is required`;
  if (field.type === 'file') return fileValueSchema.nullable().refine((value) => value !== null, message);
  if (field.type === 'select') {
    const values = (field.options ?? []).map((option) => option.value);
    return z.string().refine((value) => values.includes(value), message);
  }
  return z.string().trim().min(1, message);
}

function optionalSchema(field: CustomDocumentField): z.ZodType {
  if (field.type === 'file') return fileValueSchema.nullable().optional();
  return z.string().optional();
}

/**
 * Client-side mirror of the API's submission validation, for inline errors.
 * The API re-validates authoritatively with the shared schema.
 */
export function buildSubmissionFormSchema(fields: ReadonlyArray<CustomDocumentField>) {
  const shape: Record<string, z.ZodType> = {
    submissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Document date is required'),
  };
  for (const field of fields) {
    shape[field.key] = field.required ? valueSchema(field) : optionalSchema(field);
  }
  return z.object(shape);
}

export type SubmissionFormValues = Record<string, unknown>;

export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function emptySubmissionValues(fields: ReadonlyArray<CustomDocumentField>): SubmissionFormValues {
  const values: SubmissionFormValues = { submissionDate: todayIsoDate() };
  for (const field of fields) values[field.key] = field.type === 'file' ? null : '';
  return values;
}

/** Drop empty optional values before sending. */
export function toSubmissionPayload(values: SubmissionFormValues): SubmissionFormValues {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}
