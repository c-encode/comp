import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@db';
import { CustomDocumentTypesService } from './custom-document-types.service';

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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customDocumentSubmission: {
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

const mockDb = db as unknown as {
  documentSection: Record<
    'findMany' | 'findFirst' | 'create' | 'update' | 'delete',
    jest.Mock
  >;
  customDocumentType: Record<
    'findMany' | 'findFirst' | 'create' | 'update' | 'delete',
    jest.Mock
  >;
  customDocumentSubmission: Record<'groupBy' | 'findFirst', jest.Mock>;
};

const ORG = 'org_1';
const fileField = {
  key: 'diagram',
  label: 'Diagram',
  type: 'file',
  required: true,
};

function typeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cdt_1',
    title: 'Architecture Diagram',
    description: '',
    sectionId: 'dsc_1',
    builtInCategory: null,
    fields: [fileField],
    createdAt: new Date('2026-11-01'),
    updatedAt: new Date('2026-11-01'),
    section: { id: 'dsc_1', name: 'Architecture' },
    _count: { submissions: 0 },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('CustomDocumentTypesService', () => {
  const service = new CustomDocumentTypesService();

  it('creates a type in a custom section of the same organization', async () => {
    mockDb.documentSection.findFirst.mockResolvedValue({ id: 'dsc_1' });
    mockDb.customDocumentType.create.mockResolvedValue(typeRow());

    const result = await service.create({
      organizationId: ORG,
      userId: 'usr_1',
      payload: {
        title: 'Architecture Diagram',
        sectionId: 'dsc_1',
        fields: [fileField],
      },
    });

    expect(mockDb.documentSection.findFirst).toHaveBeenCalledWith({
      where: { id: 'dsc_1', organizationId: ORG },
      select: { id: true },
    });
    expect(
      mockDb.customDocumentType.create.mock.calls[0][0].data,
    ).toMatchObject({
      organizationId: ORG,
      sectionId: 'dsc_1',
      builtInCategory: null,
      createdById: 'usr_1',
    });
    expect(result.fields).toEqual([fileField]);
    expect(result.submissionCount).toBe(0);
  });

  it('rejects a section that belongs to another organization', async () => {
    mockDb.documentSection.findFirst.mockResolvedValue(null);
    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: { title: 'X', sectionId: 'dsc_other', fields: [fileField] },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.customDocumentType.create).not.toHaveBeenCalled();
  });

  it('requires exactly one placement', async () => {
    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: {
          title: 'X',
          sectionId: 'dsc_1',
          builtInCategory: 'Security',
          fields: [fileField],
        },
      }),
    ).rejects.toThrow('Choose exactly one section');
    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: { title: 'X', fields: [fileField] },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a built-in section and rejects an unknown one', async () => {
    mockDb.customDocumentType.create.mockResolvedValue(
      typeRow({ sectionId: null, builtInCategory: 'Security' }),
    );
    await service.create({
      organizationId: ORG,
      userId: null,
      payload: { title: 'X', builtInCategory: 'Security', fields: [fileField] },
    });
    expect(mockDb.documentSection.findFirst).not.toHaveBeenCalled();

    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: { title: 'X', builtInCategory: 'Nope', fields: [fileField] },
      }),
    ).rejects.toThrow('Unknown built-in section');
  });

  it('rejects invalid fields: duplicate keys, reserved keys, empty dropdowns', async () => {
    const base = { title: 'X', builtInCategory: 'Security' };
    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: { ...base, fields: [fileField, fileField] },
      }),
    ).rejects.toThrow('Field keys must be unique');
    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: { ...base, fields: [{ ...fileField, key: 'submissionDate' }] },
      }),
    ).rejects.toThrow('reserved');
    await expect(
      service.create({
        organizationId: ORG,
        userId: null,
        payload: {
          ...base,
          fields: [
            { key: 'env', label: 'Env', type: 'select', required: true },
          ],
        },
      }),
    ).rejects.toThrow('at least one option');
  });

  it('lists types with their last submission date', async () => {
    mockDb.customDocumentType.findMany.mockResolvedValue([
      typeRow({ _count: { submissions: 2 } }),
    ]);
    mockDb.customDocumentSubmission.groupBy.mockResolvedValue([
      {
        documentTypeId: 'cdt_1',
        _max: { submittedAt: new Date('2026-11-06T00:00:00.000Z') },
      },
    ]);

    const [type] = await service.list(ORG);
    expect(mockDb.customDocumentType.findMany.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
    });
    expect(type.submissionCount).toBe(2);
    expect(type.lastSubmittedAt).toBe('2026-11-06T00:00:00.000Z');
  });

  it('moves a type to a built-in section on update, clearing the custom one', async () => {
    mockDb.customDocumentType.findFirst.mockResolvedValue(typeRow());
    mockDb.customDocumentSubmission.findFirst.mockResolvedValue(null);
    mockDb.customDocumentType.update.mockResolvedValue(
      typeRow({ sectionId: null, builtInCategory: 'Security' }),
    );

    await service.update({
      organizationId: ORG,
      typeId: 'cdt_1',
      payload: { sectionId: null, builtInCategory: 'Security' },
    });
    expect(mockDb.customDocumentType.update.mock.calls[0][0].data).toEqual({
      sectionId: null,
      builtInCategory: 'Security',
    });
  });

  it('refuses to delete a type that has submissions', async () => {
    mockDb.customDocumentType.findFirst.mockResolvedValue(
      typeRow({ _count: { submissions: 1 } }),
    );
    mockDb.customDocumentSubmission.findFirst.mockResolvedValue({
      submittedAt: new Date(),
    });
    await expect(
      service.remove({ organizationId: ORG, typeId: 'cdt_1' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.customDocumentType.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for a type in another organization', async () => {
    mockDb.customDocumentType.findFirst.mockResolvedValue(null);
    await expect(
      service.get({ organizationId: ORG, typeId: 'cdt_x' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockDb.customDocumentType.findFirst.mock.calls[0][0].where).toEqual({
      id: 'cdt_x',
      organizationId: ORG,
    });
  });
});

