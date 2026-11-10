import { PageHeader, PageLayout } from '@trycompai/design-system';
import { CustomDocumentBreadcrumb } from '../../../components/CustomDocumentBreadcrumb';
import { CustomSubmissionDetail } from '../../../components/CustomSubmissionDetail';
import { loadDocumentType } from '../../../lib/load-document-type';

export default async function CustomDocumentSubmissionPage({
  params,
}: {
  params: Promise<{ orgId: string; typeId: string; submissionId: string }>;
}) {
  const { orgId, typeId, submissionId } = await params;
  const documentType = await loadDocumentType(typeId);

  return (
    <PageLayout>
      <CustomDocumentBreadcrumb
        orgId={orgId}
        crumbs={[
          { label: documentType.title, href: `/${orgId}/documents/custom/${typeId}` },
          { label: 'Record' },
        ]}
      />
      <PageHeader title={`${documentType.title} record`} />
      <CustomSubmissionDetail organizationId={orgId} typeId={typeId} submissionId={submissionId} />
    </PageLayout>
  );
}
