import { CUSTOM_DOCUMENT_RESERVED_KEYS } from '@trycompai/company';

const RESERVED_KEYS: ReadonlySet<string> = new Set(CUSTOM_DOCUMENT_RESERVED_KEYS);

/**
 * Turn a field label into a stable camelCase key ("Diagram file" ->
 * "diagramFile"), unique among `existingKeys`. Keys are fixed once a field is
 * saved, so renaming a label never orphans past submissions.
 */
export function toFieldKey(params: { label: string; existingKeys: ReadonlyArray<string> }): string {
  const words = params.label
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let base = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
    .slice(0, 48);

  if (!/^[a-z]/.test(base)) base = `field${base ? base[0].toUpperCase() + base.slice(1) : ''}`;

  const taken = new Set([...params.existingKeys, ...RESERVED_KEYS]);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}
