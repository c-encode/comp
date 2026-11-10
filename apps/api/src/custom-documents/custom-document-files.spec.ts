import { buildCustomDocumentSubmissionSchema } from '@trycompai/company';
import {
  assertFileKeysBelongToType,
  refreshFileUrls,
  withoutDownloadUrls,
} from './custom-document-files';

const ORG = 'org_1';
const TYPE = 'cdt_1';
const ownKey = `${ORG}/attachments/custom-documents/${TYPE}/1-a.pdf`;
const file = (fileKey: string) => ({ fileName: 'a.pdf', fileKey, downloadUrl: 'https://s3/x' });

describe('assertFileKeysBelongToType', () => {
  const check = (fileKey: string) => () =>
    assertFileKeysBelongToType({
      data: { submissionDate: '2026-11-09', diagram: file(fileKey) },
      organizationId: ORG,
      typeId: TYPE,
    });

  it('accepts a file uploaded for this type', () => {
    expect(check(ownKey)).not.toThrow();
  });

  it.each([
    ['another organization', `org_2/attachments/custom-documents/${TYPE}/a.pdf`],
    ['another type', `${ORG}/attachments/custom-documents/cdt_2/a.pdf`],
    ['an upload outside the type folder', `${ORG}/uploads/document/a.pdf`],
    ['a path that climbs out with ..', `${ORG}/attachments/custom-documents/${TYPE}/../../../org_2/a.pdf`],
  ])('rejects a file from %s', (_case, fileKey) => {
    expect(check(fileKey)).toThrow('not uploaded for this document type');
  });
});

describe('withoutDownloadUrls', () => {
  it('drops client-sent links from every file and leaves other values alone', () => {
    expect(
      withoutDownloadUrls({
        submissionDate: '2026-11-09',
        diagram: { fileName: 'a.pdf', fileKey: ownKey, downloadUrl: 'javascript:alert(1)' },
        notes: 'kept',
      }),
    ).toEqual({
      submissionDate: '2026-11-09',
      diagram: { fileName: 'a.pdf', fileKey: ownKey },
      notes: 'kept',
    });
  });
});

describe('refreshFileUrls', () => {
  const presign = jest.fn(async (key: string) => `https://s3/fresh/${key}`);

  it('presigns files under any key, including fields since removed from the type', async () => {
    const data = await refreshFileUrls({
      data: { oldDiagram: { fileName: 'a.pdf', fileKey: ownKey }, notes: 'n' },
      organizationId: ORG,
      presign,
    });
    expect(data).toEqual({
      oldDiagram: { fileName: 'a.pdf', fileKey: ownKey, downloadUrl: `https://s3/fresh/${ownKey}` },
      notes: 'n',
    });
  });

  it('never presigns a key outside the organization', async () => {
    presign.mockClear();
    const data = await refreshFileUrls({
      data: { diagram: { fileName: 'a.pdf', fileKey: `${ORG}/../org_2/a.pdf` } },
      organizationId: ORG,
      presign,
    });
    expect(data.diagram).toMatchObject({ downloadUrl: null });
    expect(presign).not.toHaveBeenCalled();
  });
});

describe('document date', () => {
  const schema = buildCustomDocumentSubmissionSchema([]);

  it('accepts a real calendar date', () => {
    expect(schema.safeParse({ submissionDate: '2024-02-29' }).success).toBe(true);
  });

  it.each(['2026-99-99', '2026-02-30', '2026-11-09<img src=x>', '2026-11-09T00:00:00Z', ''])(
    'rejects %p',
    (submissionDate) => {
      expect(schema.safeParse({ submissionDate }).success).toBe(false);
    },
  );

  it('says the date is required when it is missing', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Document date is required');
  });
});
