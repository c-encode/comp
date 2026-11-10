import { describe, expect, it } from 'vitest';
import type { CustomDocumentType } from '../hooks/use-custom-documents';
import { buildDocumentPageSections } from './document-sections';
import { DEFAULT_NEW_FIELDS, toApiPayload, toFormValues } from './document-type-form-schema';
import { toFieldKey } from './field-keys';
import { labelFromFieldKey, removedFieldValues } from './removed-field-values';
import { buildSubmissionFormSchema, toSubmissionPayload } from './submission-form-schema';

function customType(overrides: Partial<CustomDocumentType>): CustomDocumentType {
  return {
    id: 'cdt_1',
    title: 'Architecture Diagram',
    description: '',
    sectionId: null,
    builtInCategory: null,
    section: null,
    fields: [{ key: 'document', label: 'Document', type: 'file', required: true }],
    submissionCount: 0,
    lastSubmittedAt: null,
    ...overrides,
  };
}

describe('buildDocumentPageSections', () => {
  const builtInForms = [
    { type: 'a', category: 'Governance' },
    { type: 'b', category: 'Security' },
    { type: 'c', category: 'Governance' },
  ];

  it('keeps built-in order, appends custom sections by position, and places custom types', () => {
    const result = buildDocumentPageSections({
      builtInForms,
      sections: [
        { id: 'dsc_2', name: 'Vendors', position: 1, documentTypeCount: 0 },
        { id: 'dsc_1', name: 'Architecture', position: 0, documentTypeCount: 1 },
      ],
      customTypes: [
        customType({ id: 'cdt_1', sectionId: 'dsc_1' }),
        customType({ id: 'cdt_2', builtInCategory: 'Security' }),
        customType({ id: 'cdt_orphan', sectionId: 'dsc_missing' }),
      ],
    });

    expect(result.map((section) => section.name)).toEqual([
      'Governance',
      'Security',
      'Architecture',
      'Vendors',
    ]);
    expect(result[0].builtInForms.map((form) => form.type)).toEqual(['a', 'c']);
    expect(result[1].customTypes.map((type) => type.id)).toEqual(['cdt_2']);
    expect(result[2].customTypes.map((type) => type.id)).toEqual(['cdt_1']);
    // Empty custom sections are still shown so a new section is visible.
    expect(result[3].customSection?.id).toBe('dsc_2');
    expect(result[3].customTypes).toEqual([]);
  });
});

describe('toFieldKey', () => {
  it('camelCases labels and avoids collisions and reserved keys', () => {
    expect(toFieldKey({ label: 'Diagram file', existingKeys: [] })).toBe('diagramFile');
    expect(toFieldKey({ label: 'Diagram file', existingKeys: ['diagramFile'] })).toBe('diagramFile2');
    expect(toFieldKey({ label: 'Submission date', existingKeys: [] })).toBe('submissionDate2');
    expect(toFieldKey({ label: '2026 review', existingKeys: [] })).toBe('field2026Review');
    expect(toFieldKey({ label: '!!!', existingKeys: [] })).toBe('field');
  });
});

describe('toApiPayload', () => {
  it('assigns keys only to new fields and keeps existing keys when labels change', () => {
    const payload = toApiPayload({
      values: {
        title: ' Data Flow ',
        description: '',
        placement: 'section:dsc_1',
        fields: [
          { key: 'document', label: 'Renamed file', type: 'file', required: true, description: '', optionsText: '' },
          { key: '', label: 'Document', type: 'text', required: false, description: ' help ', optionsText: '' },
        ],
      },
    });

    expect(payload).toMatchObject({ title: 'Data Flow', sectionId: 'dsc_1', builtInCategory: null });
    expect(payload.fields.map((field) => field.key)).toEqual(['document', 'document2']);
    expect(payload.fields[1].description).toBe('help');
  });

  it('maps built-in placement and preserves stored dropdown values for unchanged labels', () => {
    const previous = customType({
      fields: [
        {
          key: 'env',
          label: 'Environment',
          type: 'select',
          required: true,
          options: [{ label: 'Production', value: 'prod' }],
        },
      ],
    });
    const values = { ...toFormValues(previous), placement: 'builtin:Security' };
    values.fields[0].optionsText = 'Production\nStaging\nStaging';

    const payload = toApiPayload({ values, previous });
    expect(payload.builtInCategory).toBe('Security');
    expect(payload.sectionId).toBeNull();
    expect(payload.fields[0].options).toEqual([
      { label: 'Production', value: 'prod' },
      { label: 'Staging', value: 'Staging' },
    ]);
  });

  it('starts new types with a required file and optional notes', () => {
    expect(DEFAULT_NEW_FIELDS.map((field) => [field.type, field.required])).toEqual([
      ['file', true],
      ['textarea', false],
    ]);
  });
});

describe('buildSubmissionFormSchema', () => {
  const schema = buildSubmissionFormSchema([
    { key: 'document', label: 'Document', type: 'file', required: true },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ]);

  it('requires the date and required fields', () => {
    const result = schema.safeParse({ submissionDate: '', document: null, notes: '' });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['submissionDate', 'document']));
  });

  it('accepts a complete record and drops empty optional values from the payload', () => {
    const values = {
      submissionDate: '2026-11-06',
      document: { fileName: 'a.pdf', fileKey: 'org/a.pdf', downloadUrl: 'https://x' },
      notes: '',
    };
    expect(schema.safeParse(values).success).toBe(true);
    expect(toSubmissionPayload(values)).toEqual({
      submissionDate: '2026-11-06',
      document: values.document,
    });
  });
});

describe('removedFieldValues', () => {
  const fields = [{ key: 'notes', label: 'Notes', type: 'textarea' as const, required: false }];

  it('keeps values whose field was removed from the type, so archived files stay visible', () => {
    const file = { fileName: 'a.pdf', fileKey: 'org_1/a.pdf', downloadUrl: 'https://s3/a' };
    expect(
      removedFieldValues({
        data: { submissionDate: '2026-11-09', notes: 'n', document: file, empty: '' },
        fields,
      }),
    ).toEqual([{ key: 'document', label: 'Document', value: file }]);
  });

  it('turns stored keys into readable labels', () => {
    expect(labelFromFieldKey('diagramFile')).toBe('Diagram file');
    expect(labelFromFieldKey('review_owner2')).toBe('Review owner2');
  });
});

describe('reserved field keys', () => {
  it('never generates a key that shadows the record date or an Object.prototype name', () => {
    expect(toFieldKey({ label: 'Constructor', existingKeys: [] })).not.toBe('constructor');
    expect(toFieldKey({ label: 'Submission date', existingKeys: [] })).not.toBe('submissionDate');
  });
});
