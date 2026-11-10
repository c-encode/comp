import { AttachmentsService } from '@/attachments/attachments.service';
import { UploadsService } from '@/uploads/uploads.service';
import { validateFileContent } from '@/utils/file-type-validation';
import { db } from '@db';
import {
  buildCustomDocumentSubmissionSchema,
  reviewCustomDocumentSubmissionSchema,
} from '@trycompai/company';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  assertFileKeysBelongToType,
  decodeBase64File,
  MAX_CUSTOM_DOCUMENT_FILE_BYTES,
  refreshFileUrls,
  withoutDownloadUrls,
} from './custom-document-files';
import { CustomDocumentTypesService } from './custom-document-types.service';
import { parseOrThrow } from './zod-errors';

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const submitBodySchema = z.object({ data: z.record(z.string(), z.unknown()) });

const uploadBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().trim().min(1).max(255),
  fileData: z.string().min(1).optional(),
  s3Key: z.string().min(1).optional(),
});

const userSelect = { select: { id: true, name: true, email: true } } as const;
const submissionInclude = {
  submittedBy: userSelect,
  reviewedBy: userSelect,
} as const;

@Injectable()
export class CustomDocumentSubmissionsService {
  constructor(
    private readonly types: CustomDocumentTypesService,
    private readonly attachments: AttachmentsService,
    private readonly uploads: UploadsService,
  ) {}

  private presign = (fileKey: string) =>
    this.attachments.getPresignedDownloadUrl(fileKey);

  async list(params: {
    organizationId: string;
    typeId: string;
    search?: string;
    limit?: string;
    offset?: string;
  }) {
    const type = await this.types.get(params);
    const query = parseOrThrow(listQuerySchema, params);

    const submissions = await db.customDocumentSubmission.findMany({
      where: { organizationId: params.organizationId, documentTypeId: type.id },
      include: submissionInclude,
      orderBy: { submittedAt: 'desc' },
    });

    const needle = query.search?.toLowerCase();
    const filtered = needle
      ? submissions.filter((s) =>
          JSON.stringify(s.data).toLowerCase().includes(needle),
        )
      : submissions;
    const page = filtered.slice(query.offset, query.offset + query.limit);

    const withUrls = await Promise.all(
      page.map(async (submission) => ({
        ...submission,
        data: await refreshFileUrls({
          data: z.record(z.string(), z.unknown()).parse(submission.data),
          organizationId: params.organizationId,
          presign: this.presign,
        }),
      })),
    );

    return {
      documentType: type,
      submissions: withUrls,
      total: filtered.length,
    };
  }

  private async findSubmissionOrThrow(params: {
    organizationId: string;
    typeId: string;
    submissionId: string;
  }) {
    const submission = await db.customDocumentSubmission.findFirst({
      where: {
        id: params.submissionId,
        organizationId: params.organizationId,
        documentTypeId: params.typeId,
      },
      include: submissionInclude,
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async get(params: {
    organizationId: string;
    typeId: string;
    submissionId: string;
  }) {
    const type = await this.types.get(params);
    const submission = await this.findSubmissionOrThrow(params);
    return {
      documentType: type,
      submission: {
        ...submission,
        data: await refreshFileUrls({
          data: z.record(z.string(), z.unknown()).parse(submission.data),
          organizationId: params.organizationId,
          presign: this.presign,
        }),
      },
    };
  }

  async submit(params: {
    organizationId: string;
    typeId: string;
    userId: string | null;
    payload: unknown;
  }) {
    const type = await this.types.get(params);
    const { data: rawData } = parseOrThrow(submitBodySchema, params.payload);
    const data = parseOrThrow(
      buildCustomDocumentSubmissionSchema(type.fields),
      rawData,
    );

    assertFileKeysBelongToType({
      data,
      organizationId: params.organizationId,
      typeId: type.id,
    });

    return db.customDocumentSubmission.create({
      data: {
        organizationId: params.organizationId,
        documentTypeId: type.id,
        submittedById: params.userId,
        // Optional fields left empty parse to undefined; drop them so they are stored as absent.
        data: z
          .record(z.string(), z.json())
          .parse(
            withoutDownloadUrls(
              Object.fromEntries(
                Object.entries(data).filter(([, value]) => value !== undefined),
              ),
            ),
          ),
      },
      include: submissionInclude,
    });
  }

  async uploadFile(params: {
    organizationId: string;
    typeId: string;
    payload: unknown;
  }) {
    const type = await this.types.get(params);
    const input = parseOrThrow(uploadBodySchema, params.payload);

    const fileData =
      input.fileData ??
      (input.s3Key
        ? await this.uploads.readUploadAsBase64(
            params.organizationId,
            input.s3Key,
            MAX_CUSTOM_DOCUMENT_FILE_BYTES,
          )
        : undefined);
    if (!fileData) {
      throw new BadRequestException(
        'Provide either fileData (base64) or s3Key from /v1/uploads/presign.',
      );
    }

    const buffer = decodeBase64File(fileData);
    validateFileContent(buffer, input.fileType, input.fileName);

    const fileKey = await this.attachments.uploadToS3(
      buffer,
      input.fileName,
      input.fileType,
      params.organizationId,
      'custom-documents',
      type.id,
    );
    return {
      fileName: input.fileName,
      fileKey,
      downloadUrl: await this.presign(fileKey),
    };
  }

  async review(params: {
    organizationId: string;
    typeId: string;
    submissionId: string;
    reviewerUserId: string;
    payload: unknown;
  }) {
    const input = parseOrThrow(
      reviewCustomDocumentSubmissionSchema,
      params.payload,
    );
    const submission = await this.findSubmissionOrThrow(params);
    if (submission.status !== 'pending') {
      throw new BadRequestException(
        'Submission must be pending to be reviewed',
      );
    }

    return db.customDocumentSubmission.update({
      where: { id: submission.id },
      data: {
        status: input.action,
        reviewedById: params.reviewerUserId,
        reviewedAt: new Date(),
        reviewReason: input.reason,
      },
      include: submissionInclude,
    });
  }

  async remove(params: {
    organizationId: string;
    typeId: string;
    submissionId: string;
  }) {
    const submission = await this.findSubmissionOrThrow(params);
    await db.customDocumentSubmission.delete({ where: { id: submission.id } });
    return { success: true, id: submission.id };
  }
}
