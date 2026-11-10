import type { CustomDocumentType, DocumentSection } from '../hooks/use-custom-documents';

export interface DocumentPageSection<TForm> {
  key: string;
  name: string;
  /** Set for organization-defined sections, which can be renamed and deleted. */
  customSection: DocumentSection | null;
  builtInForms: TForm[];
  customTypes: CustomDocumentType[];
}

/**
 * Merge built-in forms (grouped by their category) with organization-defined
 * sections and types. Built-in sections keep their order and come first;
 * custom sections follow in their saved order. Empty custom sections are kept
 * so a freshly created section is visible.
 */
export function buildDocumentPageSections<TForm extends { category: string }>(params: {
  builtInForms: ReadonlyArray<TForm>;
  sections: ReadonlyArray<DocumentSection>;
  customTypes: ReadonlyArray<CustomDocumentType>;
}): DocumentPageSection<TForm>[] {
  const result: DocumentPageSection<TForm>[] = [];
  const byBuiltInName = new Map<string, DocumentPageSection<TForm>>();

  for (const form of params.builtInForms) {
    let section = byBuiltInName.get(form.category);
    if (!section) {
      section = {
        key: `builtin:${form.category}`,
        name: form.category,
        customSection: null,
        builtInForms: [],
        customTypes: [],
      };
      byBuiltInName.set(form.category, section);
      result.push(section);
    }
    section.builtInForms.push(form);
  }

  const byCustomId = new Map<string, DocumentPageSection<TForm>>();
  const orderedSections = [...params.sections].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );
  for (const customSection of orderedSections) {
    const section: DocumentPageSection<TForm> = {
      key: `custom:${customSection.id}`,
      name: customSection.name,
      customSection,
      builtInForms: [],
      customTypes: [],
    };
    byCustomId.set(customSection.id, section);
    result.push(section);
  }

  for (const type of params.customTypes) {
    const target = type.sectionId
      ? byCustomId.get(type.sectionId)
      : byBuiltInName.get(type.builtInCategory ?? '');
    target?.customTypes.push(type);
  }

  return result;
}
