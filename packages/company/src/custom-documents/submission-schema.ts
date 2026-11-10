import { z } from 'zod';
import { evidenceFormFileSchema } from '../evidence-forms/file-schema';
import type { CustomDocumentField } from './schemas';

function requiredMessage(label: string): string {
  return `${label} is required`;
}

function dateSchema(label: string) {
  // A real calendar date in YYYY-MM-DD form; rejects 2026-99-99 and trailing text.
  return z.iso.date({
    error: (issue) =>
      issue.input === undefined ? requiredMessage(label) : `${label} must be a valid date (YYYY-MM-DD)`,
  });
}

function fieldValueSchema(field: CustomDocumentField): z.ZodType {
  switch (field.type) {
    case 'file':
      // Same shape as built-in evidence files, with a readable "is required" message.
      return z.object(evidenceFormFileSchema.shape, { error: requiredMessage(field.label) });
    case 'date':
      return dateSchema(field.label);
    case 'select': {
      const values = (field.options ?? []).map((option) => option.value);
      return z
        .string({ error: requiredMessage(field.label) })
        .refine((value) => values.includes(value), `Choose a valid ${field.label}`);
    }
    case 'text':
    case 'textarea':
      return z
        .string({ error: requiredMessage(field.label) })
        .trim()
        .min(1, requiredMessage(field.label))
        .max(field.type === 'text' ? 1000 : 50_000);
  }
}

/**
 * Optional fields accept an absent value or an empty string (what an untouched
 * input sends); both are stored as absent.
 */
function optionalFieldSchema(field: CustomDocumentField): z.ZodType {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    fieldValueSchema(field).optional(),
  );
}

/**
 * Build the Zod schema for one custom document type's submission payload.
 * Every submission has a `submissionDate` (the date the record is for) plus
 * one entry per field. Unknown keys are stripped.
 */
export function buildCustomDocumentSubmissionSchema(fields: ReadonlyArray<CustomDocumentField>) {
  const shape: Record<string, z.ZodType> = {
    submissionDate: dateSchema('Document date'),
  };
  for (const field of fields) {
    shape[field.key] = field.required ? fieldValueSchema(field) : optionalFieldSchema(field);
  }
  return z.object(shape);
}
