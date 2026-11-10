import { PageLayout } from '@trycompai/design-system';
import { CustomDocumentBreadcrumb } from '../components/CustomDocumentBreadcrumb';
import { CustomDocumentTypePageClient } from '../components/CustomDocumentTypePageClient';
import { loadDocumentType } from '../lib/load-document-type';

export default async function CustomDocumentTypePage({
  params,
}: {
  params: Promise<{ orgId: string; typeId: string }>;
}) {
  const { orgId, typeId } = await params;
  const documentType = await loadDocumentType(typeId);

  return (
    <PageLayout>
      <CustomDocumentBreadcrumb orgId={orgId} crumbs={[{ label: documentType.title }]} />
      <CustomDocumentTypePageClient organizationId={orgId} typeId={typeId} />
    </PageLayout>
  );
}
