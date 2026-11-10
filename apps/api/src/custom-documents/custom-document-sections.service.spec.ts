import { BadRequestException, ConflictException } from '@nestjs/common';
import { db } from '@db';
import { CustomDocumentSectionsService } from './custom-document-sections.service';

jest.mock('@db', () => ({
  db: {
    documentSection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customDocumentType: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockDb = db as unknown as {
  documentSection: Record<
    'findMany' | 'findFirst' | 'create' | 'update' | 'delete',
    jest.Mock
  >;
  customDocumentType: Record<'findMany' | 'count', jest.Mock>;
};

const ORG = 'org_1';

beforeEach(() => jest.clearAllMocks());

describe('CustomDocumentSectionsService', () => {
  const service = new CustomDocumentSectionsService();

  it('appends a new section after the last one', async () => {
    mockDb.documentSection.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ position: 3 });
    mockDb.documentSection.create.mockResolvedValue({
      id: 'dsc_2',
      name: 'Architecture',
      position: 4,
    });

    await service.create({
      organizationId: ORG,
      payload: { name: '  Architecture ' },
    });
    expect(mockDb.documentSection.create.mock.calls[0][0].data).toEqual({
      organizationId: ORG,
      name: 'Architecture',
      position: 4,
    });
  });

  it('rejects names that clash with built-in or existing sections', async () => {
    await expect(
      service.create({ organizationId: ORG, payload: { name: 'security' } }),
    ).rejects.toThrow(ConflictException);
    mockDb.documentSection.findFirst.mockResolvedValueOnce({ id: 'dsc_1' });
    await expect(
      service.create({
        organizationId: ORG,
        payload: { name: 'Architecture' },
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockDb.documentSection.create).not.toHaveBeenCalled();
  });

  it('refuses to delete a section that still has types', async () => {
    mockDb.documentSection.findFirst.mockResolvedValue({
      id: 'dsc_1',
      _count: { documentTypes: 2 },
    });
    await expect(
      service.remove({ organizationId: ORG, sectionId: 'dsc_1' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.documentSection.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty section', async () => {
    mockDb.documentSection.findFirst.mockResolvedValue({
      id: 'dsc_1',
      _count: { documentTypes: 0 },
    });
    await expect(
      service.remove({ organizationId: ORG, sectionId: 'dsc_1' }),
    ).resolves.toEqual({
      success: true,
      id: 'dsc_1',
    });
  });
});
