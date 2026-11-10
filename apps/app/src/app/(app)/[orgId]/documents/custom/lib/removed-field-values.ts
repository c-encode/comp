import type { CustomDocumentField } from '@trycompai/company';

/** Turn a stored field key such as `diagramFile` into a readable label: "Diagram file". */
export function labelFromFieldKey(key: string): string {
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Values stored on a record for fields the type no longer has. Records are an
 * archive, so editing the type must never hide what was submitted.
 */
export function removedFieldValues(params: {
  data: Record<string, unknown>;
  fields: ReadonlyArray<CustomDocumentField>;
}): Array<{ key: string; label: string; value: unknown }> {
  const current = new Set(params.fields.map((field) => field.key));
  return Object.entries(params.data)
    .filter(([key, value]) => key !== 'submissionDate' && !current.has(key) && value != null && value !== '')
    .map(([key, value]) => ({ key, label: labelFromFieldKey(key), value }));
}
