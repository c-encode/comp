import { PageHeader, PageLayout } from '@trycompai/design-system';
import { CustomDocumentBreadcrumb } from '../../components/CustomDocumentBreadcrumb';
import { DocumentTypeForm } from '../../components/DocumentTypeForm';
import { loadDocumentType } from '../../lib/load-document-type';

export default async function EditCustomDocumentTypePage({
  params,
}: {
  params: Promise<{ orgId: string; typeId: string }>;
}) {
  const { orgId, typeId } = await params;
  const documentType = await loadDocumentType(typeId);

  return (
    <PageLayout>
      <CustomDocumentBreadcrumb
        orgId={orgId}
        crumbs={[
          { label: documentType.title, href: `/${orgId}/documents/custom/${typeId}` },
          { label: 'Edit' },
        ]}
      />
      <PageHeader title={`Edit ${documentType.title}`} />
      <DocumentTypeForm organizationId={orgId} documentType={documentType} />
    </PageLayout>
  );
}
