import { BadRequestException } from '@nestjs/common';
import type { CustomDocumentField } from '@trycompai/company';

export const MAX_CUSTOM_DOCUMENT_FILE_BYTES = 100 * 1024 * 1024;

type StoredFile = {
  fileKey: string;
  fileName?: unknown;
  downloadUrl?: unknown;
};

function isStoredFile(value: unknown): value is StoredFile {
  return (
    !!value &&
    typeof value === 'object' &&
    'fileKey' in value &&
    typeof (value as { fileKey: unknown }).fileKey === 'string'
  );
}

/** Values of this type's file fields that are present in the submission data. */
function fileEntries(params: {
  data: Record<string, unknown>;
  fields: ReadonlyArray<CustomDocumentField>;
}): Array<[string, StoredFile]> {
  const entries: Array<[string, StoredFile]> = [];
  for (const field of params.fields) {
    if (field.type !== 'file') continue;
    const value = params.data[field.key];
    if (isStoredFile(value)) entries.push([field.key, value]);
  }
  return entries;
}

/**
 * Reject a submission whose file fields point outside the caller's org
 * namespace — otherwise a caller could submit another org's fileKey and have
 * it presigned on read.
 */
export function assertFileKeysBelongToOrganization(params: {
  data: Record<string, unknown>;
  fields: ReadonlyArray<CustomDocumentField>;
  organizationId: string;
}): void {
  const orgPrefix = `${params.organizationId}/`;
  for (const [, file] of fileEntries(params)) {
    if (!file.fileKey.startsWith(orgPrefix)) {
      throw new BadRequestException(
        'Submitted file does not belong to this organization',
      );
    }
  }
}

/** Replace stored (expired) download URLs with fresh presigned ones. */
export async function refreshFileUrls(params: {
  data: Record<string, unknown>;
  fields: ReadonlyArray<CustomDocumentField>;
  organizationId: string;
  presign: (fileKey: string) => Promise<string>;
}): Promise<Record<string, unknown>> {
  const refreshed: Record<string, unknown> = { ...params.data };
  const orgPrefix = `${params.organizationId}/`;
  for (const [key, file] of fileEntries(params)) {
    refreshed[key] = {
      ...file,
      downloadUrl: file.fileKey.startsWith(orgPrefix)
        ? await params.presign(file.fileKey)
        : null,
    };
  }
  return refreshed;
}

export function decodeBase64File(fileData: string): Buffer {
  const normalized = fileData.trim();
  if (normalized.length === 0 || normalized.length % 4 !== 0) {
    throw new BadRequestException('Invalid file data. Expected base64 string.');
  }
  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.toString('base64') !== normalized) {
    throw new BadRequestException('Invalid file data. Expected base64 string.');
  }
  if (!buffer.length) {
    throw new BadRequestException('File cannot be empty.');
  }
  if (buffer.length > MAX_CUSTOM_DOCUMENT_FILE_BYTES) {
    throw new BadRequestException(
      `File exceeds the ${MAX_CUSTOM_DOCUMENT_FILE_BYTES / (1024 * 1024)}MB limit`,
    );
  }
  return buffer;
}
