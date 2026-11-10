import { Breadcrumb } from '@trycompai/design-system';
import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb starting at Documents; the last crumb is the current page. */
export function CustomDocumentBreadcrumb({ orgId, crumbs }: { orgId: string; crumbs: Crumb[] }) {
  const all: Crumb[] = [{ label: 'Documents', href: `/${orgId}/documents` }, ...crumbs];
  return (
    <Breadcrumb
      items={all.map((crumb, index) =>
        index === all.length - 1 || !crumb.href
          ? { label: crumb.label, isCurrent: true }
          : { label: crumb.label, href: crumb.href, props: { render: <Link href={crumb.href} /> } },
      )}
    />
  );
}
