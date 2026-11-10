import { db, type Prisma } from '@db';
import {
  createCustomDocumentTypeSchema,
  parseStoredCustomDocumentFields,
  updateCustomDocumentTypeSchema,
} from '@trycompai/company';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseOrThrow } from './zod-errors';

const typeSelect = {
  id: true,
  title: true,
  description: true,
  sectionId: true,
  builtInCategory: true,
  fields: true,
  createdAt: true,
  updatedAt: true,
  section: { select: { id: true, name: true } },
  _count: { select: { submissions: true } },
} as const;

type TypeRow = Prisma.CustomDocumentTypeGetPayload<{
  select: typeof typeSelect;
}>;

function toResponse(row: TypeRow, lastSubmittedAt: Date | null = null) {
  const { _count, fields, ...rest } = row;
  return {
    ...rest,
    fields: parseStoredCustomDocumentFields(fields),
    submissionCount: _count.submissions,
    lastSubmittedAt: lastSubmittedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class CustomDocumentTypesService {
  async list(organizationId: string) {
    const [types, latest] = await Promise.all([
      db.customDocumentType.findMany({
        where: { organizationId },
        select: typeSelect,
        orderBy: { title: 'asc' },
      }),
      db.customDocumentSubmission.groupBy({
        by: ['documentTypeId'],
        where: { organizationId },
        _max: { submittedAt: true },
      }),
    ]);
    const latestByType = new Map(
      latest.map((row) => [row.documentTypeId, row._max.submittedAt]),
    );
    return types.map((type) =>
      toResponse(type, latestByType.get(type.id) ?? null),
    );
  }

  async get(params: { organizationId: string; typeId: string }) {
    const type = await db.customDocumentType.findFirst({
      where: { id: params.typeId, organizationId: params.organizationId },
      select: typeSelect,
    });
    if (!type) throw new NotFoundException('Document type not found');

    const latest = await db.customDocumentSubmission.findFirst({
      where: { documentTypeId: type.id, organizationId: params.organizationId },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    });
    return toResponse(type, latest?.submittedAt ?? null);
  }

  private async assertSectionInOrg(params: {
    organizationId: string;
    sectionId: string;
  }) {
    const section = await db.documentSection.findFirst({
      where: { id: params.sectionId, organizationId: params.organizationId },
      select: { id: true },
    });
    if (!section) throw new BadRequestException('Section not found');
  }

  async create(params: {
    organizationId: string;
    userId: string | null;
    payload: unknown;
  }) {
    const input = parseOrThrow(createCustomDocumentTypeSchema, params.payload);
    if (input.sectionId) {
      await this.assertSectionInOrg({
        organizationId: params.organizationId,
        sectionId: input.sectionId,
      });
    }

    const created = await db.customDocumentType.create({
      data: {
        organizationId: params.organizationId,
        title: input.title,
        description: input.description,
        sectionId: input.sectionId ?? null,
        builtInCategory: input.builtInCategory ?? null,
        fields: input.fields,
        createdById: params.userId,
      },
      select: typeSelect,
    });
    return toResponse(created);
  }

  async update(params: {
    organizationId: string;
    typeId: string;
    payload: unknown;
  }) {
    const input = parseOrThrow(updateCustomDocumentTypeSchema, params.payload);
    await this.get(params);
    if (input.sectionId) {
      await this.assertSectionInOrg({
        organizationId: params.organizationId,
        sectionId: input.sectionId,
      });
    }

    const placementChanged =
      input.sectionId !== undefined || input.builtInCategory !== undefined;
    const updated = await db.customDocumentType.update({
      where: { id: params.typeId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.fields !== undefined ? { fields: input.fields } : {}),
        ...(placementChanged
          ? {
              sectionId: input.sectionId ?? null,
              builtInCategory: input.builtInCategory ?? null,
            }
          : {}),
      },
      select: typeSelect,
    });
    return toResponse(updated);
  }

  async remove(params: { organizationId: string; typeId: string }) {
    const type = await this.get(params);
    if (type.submissionCount > 0) {
      throw new BadRequestException(
        'This document type has submissions. Delete them first so archived records are not lost by accident.',
      );
    }
    await db.customDocumentType.delete({ where: { id: params.typeId } });
    return { success: true, id: params.typeId };
  }
}
