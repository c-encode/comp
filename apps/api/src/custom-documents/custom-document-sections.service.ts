import { db } from '@db';
import {
  builtInDocumentCategories,
  createDocumentSectionSchema,
  updateDocumentSectionSchema,
} from '@trycompai/company';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseOrThrow } from './zod-errors';

const sectionSelect = {
  id: true,
  name: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { documentTypes: true } },
} as const;

function isBuiltInName(name: string): boolean {
  const lower = name.toLowerCase();
  return builtInDocumentCategories.some(
    (category) => category.toLowerCase() === lower,
  );
}

@Injectable()
export class CustomDocumentSectionsService {
  async list(organizationId: string) {
    const sections = await db.documentSection.findMany({
      where: { organizationId },
      select: sectionSelect,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return {
      builtInSections: builtInDocumentCategories,
      sections: sections.map(({ _count, ...section }) => ({
        ...section,
        documentTypeCount: _count.documentTypes,
      })),
    };
  }

  private async assertNameAvailable(params: {
    organizationId: string;
    name: string;
    excludeId?: string;
  }): Promise<void> {
    if (isBuiltInName(params.name)) {
      throw new ConflictException(
        `"${params.name}" is already a built-in section`,
      );
    }
    const existing = await db.documentSection.findFirst({
      where: {
        organizationId: params.organizationId,
        name: { equals: params.name, mode: 'insensitive' },
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `A section named "${params.name}" already exists`,
      );
    }
  }

  private async findOrThrow(params: {
    organizationId: string;
    sectionId: string;
  }) {
    const section = await db.documentSection.findFirst({
      where: { id: params.sectionId, organizationId: params.organizationId },
      select: sectionSelect,
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async create(params: { organizationId: string; payload: unknown }) {
    const input = parseOrThrow(createDocumentSectionSchema, params.payload);
    await this.assertNameAvailable({
      organizationId: params.organizationId,
      name: input.name,
    });

    const last = await db.documentSection.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return db.documentSection.create({
      data: {
        organizationId: params.organizationId,
        name: input.name,
        position: (last?.position ?? -1) + 1,
      },
      select: {
        id: true,
        name: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(params: {
    organizationId: string;
    sectionId: string;
    payload: unknown;
  }) {
    const input = parseOrThrow(updateDocumentSectionSchema, params.payload);
    await this.findOrThrow(params);
    if (input.name !== undefined) {
      await this.assertNameAvailable({
        organizationId: params.organizationId,
        name: input.name,
        excludeId: params.sectionId,
      });
    }

    return db.documentSection.update({
      where: { id: params.sectionId },
      data: input,
      select: {
        id: true,
        name: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(params: { organizationId: string; sectionId: string }) {
    const section = await this.findOrThrow(params);
    if (section._count.documentTypes > 0) {
      throw new BadRequestException(
        'Move or delete the document types in this section before deleting it',
      );
    }
    await db.documentSection.delete({ where: { id: params.sectionId } });
    return { success: true, id: params.sectionId };
  }
}
