import { BadRequestException, NotFoundException } from '@nestjs/common';
import { db } from '@db';
import type { AttachmentsService } from '@/attachments/attachments.service';
import type { UploadsService } from '@/uploads/uploads.service';
import { CustomDocumentSubmissionsService } from './custom-document-submissions.service';
import type { CustomDocumentTypesService } from './custom-document-types.service';

jest.mock('@/attachments/attachments.service', () => ({
  AttachmentsService: class {},
}));
jest.mock('@/uploads/uploads.service', () => ({ UploadsService: class {} }));
jest.mock('@/utils/file-type-validation', () => ({
  validateFileContent: jest.fn(),
}));

jest.mock('@db', () => ({
  db: {
    customDocumentSubmission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockDb = db as unknown as {
  customDocumentSubmission: Record<
    'findMany' | 'findFirst' | 'create' | 'update' | 'delete',
    jest.Mock
  >;
};

const ORG = 'org_1';
const documentType = {
  id: 'cdt_1',
  title: 'Architecture Diagram',
  fields: [
    { key: 'diagram', label: 'Diagram', type: 'file' as const, required: true },
    {
      key: 'environment',
      label: 'Environment',
      type: 'select' as const,
      required: false,
      options: [{ label: 'Production', value: 'prod' }],
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      required: false,
    },
  ],
};

const ownFile = {
  fileName: 'a.pdf',
  fileKey: `${ORG}/attachments/custom-documents/cdt_1/a.pdf`,
  downloadUrl: 'https://s3/old',
};

const types = {
  get: jest.fn(),
} as unknown as jest.Mocked<CustomDocumentTypesService>;
const attachments = {
  getPresignedDownloadUrl: jest.fn(),
  uploadToS3: jest.fn(),
} as unknown as jest.Mocked<AttachmentsService>;
const uploads = {
  readUploadAsBase64: jest.fn(),
} as unknown as jest.Mocked<UploadsService>;
const service = new CustomDocumentSubmissionsService(
  types,
  attachments,
  uploads,
);

beforeEach(() => {
  jest.clearAllMocks();
  types.get.mockResolvedValue(documentType as never);
  attachments.getPresignedDownloadUrl.mockResolvedValue('https://s3/fresh');
  mockDb.customDocumentSubmission.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 'cds_1', ...data }),
  );
});

describe('submit', () => {
  it('stores a valid submission and drops empty optional values and unknown keys', async () => {
    await service.submit({
      organizationId: ORG,
      typeId: 'cdt_1',
      userId: 'usr_1',
      payload: {
        data: {
          submissionDate: '2026-11-06',
          diagram: ownFile,
          environment: '',
          extra: 'x',
        },
      },
    });

    const { data } = mockDb.customDocumentSubmission.create.mock.calls[0][0];
    expect(data).toMatchObject({
      organizationId: ORG,
      documentTypeId: 'cdt_1',
      submittedById: 'usr_1',
    });
    expect(data.data).toEqual({
      submissionDate: '2026-11-06',
      diagram: ownFile,
    });
  });

  it('rejects a missing required file and an invalid dropdown value', async () => {
    await expect(
      service.submit({
        organizationId: ORG,
        typeId: 'cdt_1',
        userId: null,
        payload: { data: { submissionDate: '2026-11-06' } },
      }),
    ).rejects.toThrow('diagram');
    await expect(
      service.submit({
        organizationId: ORG,
        typeId: 'cdt_1',
        userId: null,
        payload: {
          data: {
            submissionDate: '2026-11-06',
            diagram: ownFile,
            environment: 'staging',
          },
        },
      }),
    ).rejects.toThrow('Choose a valid Environment');
    expect(mockDb.customDocumentSubmission.create).not.toHaveBeenCalled();
  });

  it("rejects a file that belongs to another organization's namespace", async () => {
    await expect(
      service.submit({
        organizationId: ORG,
        typeId: 'cdt_1',
        userId: null,
        payload: {
          data: {
            submissionDate: '2026-11-06',
            diagram: { ...ownFile, fileKey: 'org_2/attachments/x.pdf' },
          },
        },
      }),
    ).rejects.toThrow('does not belong to this organization');
  });
});

describe('list and get', () => {
  it('scopes by organization and type and refreshes file links', async () => {
    mockDb.customDocumentSubmission.findMany.mockResolvedValue([
      { id: 'cds_1', data: { submissionDate: '2026-11-06', diagram: ownFile } },
      { id: 'cds_2', data: { submissionDate: '2026-10-01', notes: 'older' } },
    ]);

    const result = await service.list({
      organizationId: ORG,
      typeId: 'cdt_1',
      search: 'older',
    });
    expect(
      mockDb.customDocumentSubmission.findMany.mock.calls[0][0].where,
    ).toEqual({
      organizationId: ORG,
      documentTypeId: 'cdt_1',
    });
    expect(result.total).toBe(1);
    expect(result.submissions[0].id).toBe('cds_2');

    const all = await service.list({ organizationId: ORG, typeId: 'cdt_1' });
    expect(all.submissions[0].data.diagram).toEqual({
      ...ownFile,
      downloadUrl: 'https://s3/fresh',
    });
  });

  it('404s on a submission outside the organization or type', async () => {
    mockDb.customDocumentSubmission.findFirst.mockResolvedValue(null);
    await expect(
      service.get({
        organizationId: ORG,
        typeId: 'cdt_1',
        submissionId: 'cds_x',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      mockDb.customDocumentSubmission.findFirst.mock.calls[0][0].where,
    ).toEqual({
      id: 'cds_x',
      organizationId: ORG,
      documentTypeId: 'cdt_1',
    });
  });
});

describe('review', () => {
  it('requires a reason to reject', async () => {
    await expect(
      service.review({
        organizationId: ORG,
        typeId: 'cdt_1',
        submissionId: 'cds_1',
        reviewerUserId: 'usr_1',
        payload: { action: 'rejected' },
      }),
    ).rejects.toThrow('reason');
  });

  it('only reviews pending submissions', async () => {
    mockDb.customDocumentSubmission.findFirst.mockResolvedValue({
      id: 'cds_1',
      status: 'approved',
    });
    await expect(
      service.review({
        organizationId: ORG,
        typeId: 'cdt_1',
        submissionId: 'cds_1',
        reviewerUserId: 'usr_1',
        payload: { action: 'approved' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.customDocumentSubmission.update).not.toHaveBeenCalled();
  });

  it('records the reviewer on approval', async () => {
    mockDb.customDocumentSubmission.findFirst.mockResolvedValue({
      id: 'cds_1',
      status: 'pending',
    });
    mockDb.customDocumentSubmission.update.mockResolvedValue({
      id: 'cds_1',
      status: 'approved',
    });
    await service.review({
      organizationId: ORG,
      typeId: 'cdt_1',
      submissionId: 'cds_1',
      reviewerUserId: 'usr_1',
      payload: { action: 'approved' },
    });
    expect(
      mockDb.customDocumentSubmission.update.mock.calls[0][0].data,
    ).toMatchObject({
      status: 'approved',
      reviewedById: 'usr_1',
    });
  });
});

describe('uploadFile', () => {
  it('stores the file under the type and returns submission-ready metadata', async () => {
    attachments.uploadToS3.mockResolvedValue(
      `${ORG}/attachments/custom-documents/cdt_1/x.pdf`,
    );
    const result = await service.uploadFile({
      organizationId: ORG,
      typeId: 'cdt_1',
      payload: {
        fileName: 'x.pdf',
        fileType: 'application/pdf',
        fileData: Buffer.from('%PDF-1.4').toString('base64'),
      },
    });
    expect(attachments.uploadToS3).toHaveBeenCalledWith(
      expect.any(Buffer),
      'x.pdf',
      'application/pdf',
      ORG,
      'custom-documents',
      'cdt_1',
    );
    expect(result).toEqual({
      fileName: 'x.pdf',
      fileKey: `${ORG}/attachments/custom-documents/cdt_1/x.pdf`,
      downloadUrl: 'https://s3/fresh',
    });
  });

  it('reads presigned uploads by s3Key and requires one of fileData or s3Key', async () => {
    uploads.readUploadAsBase64.mockResolvedValue(
      Buffer.from('hello').toString('base64'),
    );
    attachments.uploadToS3.mockResolvedValue(`${ORG}/attachments/k`);
    await service.uploadFile({
      organizationId: ORG,
      typeId: 'cdt_1',
      payload: {
        fileName: 'x.txt',
        fileType: 'text/plain',
        s3Key: `${ORG}/uploads/x.txt`,
      },
    });
    expect(uploads.readUploadAsBase64).toHaveBeenCalledWith(
      ORG,
      `${ORG}/uploads/x.txt`,
      expect.any(Number),
    );

    await expect(
      service.uploadFile({
        organizationId: ORG,
        typeId: 'cdt_1',
        payload: { fileName: 'x', fileType: 'text/plain' },
      }),
    ).rejects.toThrow('Provide either fileData');
  });
});
