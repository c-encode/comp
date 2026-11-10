import { PageHeader, PageLayout, Text } from '@trycompai/design-system';
import { CustomDocumentBreadcrumb } from '../../components/CustomDocumentBreadcrumb';
import { CustomSubmissionForm } from '../../components/CustomSubmissionForm';
import { loadDocumentType } from '../../lib/load-document-type';

export default async function NewCustomDocumentSubmissionPage({
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
          { label: 'New record' },
        ]}
      />
      <PageHeader title={`New ${documentType.title} record`} />
      {documentType.description && <Text variant="muted">{documentType.description}</Text>}
      <CustomSubmissionForm organizationId={orgId} documentType={documentType} />
    </PageLayout>
  );
}
