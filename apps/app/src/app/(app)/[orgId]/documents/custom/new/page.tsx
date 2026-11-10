import { PageHeader, PageLayout } from '@trycompai/design-system';
import { CustomDocumentBreadcrumb } from '../components/CustomDocumentBreadcrumb';
import { DocumentTypeForm } from '../components/DocumentTypeForm';

export default async function NewCustomDocumentTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ placement?: string }>;
}) {
  const { orgId } = await params;
  const { placement } = await searchParams;

  return (
    <PageLayout>
      <CustomDocumentBreadcrumb orgId={orgId} crumbs={[{ label: 'New document type' }]} />
      <PageHeader title="New document type" />
      <DocumentTypeForm organizationId={orgId} initialPlacement={placement} />
    </PageLayout>
  );
}
