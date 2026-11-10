import { z } from 'zod';
import { evidenceFormDefinitionList } from '../evidence-forms/definitions';

export const CUSTOM_DOCUMENT_FIELD_TYPES = ['text', 'textarea', 'date', 'select', 'file'] as const;

export const customDocumentFieldTypeSchema = z.enum(CUSTOM_DOCUMENT_FIELD_TYPES);
export type CustomDocumentFieldType = z.infer<typeof customDocumentFieldTypeSchema>;

/**
 * Keys a field may not use: `submissionDate` is every record's own date, and the
 * rest are Object.prototype names that break parsing a record.
 */
export const CUSTOM_DOCUMENT_RESERVED_KEYS = [
  'submissionDate',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
] as const;

const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]{0,63}$/;

export const MAX_CUSTOM_DOCUMENT_FIELDS = 40;
export const MAX_SELECT_OPTIONS = 50;

const selectOptionSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required').max(200),
  value: z.string().trim().min(1, 'Option value is required').max(200),
});

export const customDocumentFieldSchema = z
  .object({
    key: z
      .string()
      .regex(FIELD_KEY_PATTERN, 'Field key must start with a letter and use letters, digits or _')
      .refine(
        (key) => !(CUSTOM_DOCUMENT_RESERVED_KEYS as readonly string[]).includes(key),
        'This field key is reserved',
      ),
    label: z.string().trim().min(1, 'Field label is required').max(200),
    type: customDocumentFieldTypeSchema,
    required: z.boolean(),
    description: z.string().trim().max(1000).optional(),
    options: z.array(selectOptionSchema).max(MAX_SELECT_OPTIONS).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type !== 'select') return;
    if (!field.options || field.options.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'A dropdown needs at least one option',
      });
      return;
    }
    const values = field.options.map((option) => option.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Dropdown options must be unique',
      });
    }
  });

export type CustomDocumentField = z.infer<typeof customDocumentFieldSchema>;

export const customDocumentFieldsSchema = z
  .array(customDocumentFieldSchema)
  .min(1, 'Add at least one field')
  .max(MAX_CUSTOM_DOCUMENT_FIELDS)
  .superRefine((fields, ctx) => {
    const keys = fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: 'custom', message: 'Field keys must be unique' });
    }
  });

/**
 * Read a stored field list. Rows are written through customDocumentFieldsSchema,
 * so this only guards against hand-edited data; anything invalid reads as no fields.
 */
export function parseStoredCustomDocumentFields(value: unknown): CustomDocumentField[] {
  const result = z.array(customDocumentFieldSchema).safeParse(value);
  return result.success ? result.data : [];
}

/** Section headings that built-in document types already use. */
export const builtInDocumentCategories: readonly string[] = Array.from(
  new Set(evidenceFormDefinitionList.filter((form) => !form.hidden).map((form) => form.category)),
);

const sectionNameSchema = z.string().trim().min(1, 'Section name is required').max(100);

export const createDocumentSectionSchema = z.object({
  name: sectionNameSchema,
});

export const updateDocumentSectionSchema = z.object({
  name: sectionNameSchema.optional(),
  position: z.number().int().min(0).max(10_000).optional(),
});

/**
 * Where a type sits on the Documents page: a custom section (by id) or a
 * built-in heading (by name). Exactly one must be set.
 */
const placementSchema = z.object({
  sectionId: z.string().min(1).nullable().optional(),
  builtInCategory: z.string().min(1).nullable().optional(),
});

const typeBaseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000),
  fields: customDocumentFieldsSchema,
});

function refinePlacement(
  value: { sectionId?: string | null; builtInCategory?: string | null },
  ctx: z.RefinementCtx,
): void {
  const hasSection = !!value.sectionId;
  const hasBuiltIn = !!value.builtInCategory;
  if (hasSection === hasBuiltIn) {
    ctx.addIssue({
      code: 'custom',
      path: ['sectionId'],
      message: 'Choose exactly one section',
    });
    return;
  }
  if (hasBuiltIn && !builtInDocumentCategories.includes(value.builtInCategory as string)) {
    ctx.addIssue({
      code: 'custom',
      path: ['builtInCategory'],
      message: 'Unknown built-in section',
    });
  }
}

export const createCustomDocumentTypeSchema = typeBaseSchema
  .extend({ description: typeBaseSchema.shape.description.default('') })
  .extend(placementSchema.shape)
  .superRefine(refinePlacement);

export type CreateCustomDocumentTypeInput = z.input<typeof createCustomDocumentTypeSchema>;

export const updateCustomDocumentTypeSchema = typeBaseSchema
  .partial()
  .extend(placementSchema.shape)
  .superRefine((value, ctx) => {
    // Placement is optional on update, but when either side is sent it must be valid.
    if (value.sectionId === undefined && value.builtInCategory === undefined) return;
    refinePlacement(value, ctx);
  });

export type UpdateCustomDocumentTypeInput = z.input<typeof updateCustomDocumentTypeSchema>;

export const reviewCustomDocumentSubmissionSchema = z
  .object({
    action: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.action !== 'rejected' || !!value.reason, {
    path: ['reason'],
    message: 'A reason is required when rejecting a submission',
  });
