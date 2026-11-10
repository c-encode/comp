import { BadRequestException } from '@nestjs/common';

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

/**
 * Every file-shaped value in the record, whatever the type's fields say now.
 * Matching on the stored value (not the current field list) keeps files on old
 * records reachable after a field is removed or changes type.
 */
function fileEntries(data: Record<string, unknown>): Array<[string, StoredFile]> {
  return Object.entries(data).filter((entry): entry is [string, StoredFile] =>
    isStoredFile(entry[1]),
  );
}

/** S3 folder that `uploadFile` writes this type's files into. */
export function customDocumentFilePrefix(params: {
  organizationId: string;
  typeId: string;
}): string {
  return `${params.organizationId}/attachments/custom-documents/${params.typeId}/`;
}

function isKeyUnder(fileKey: string, prefix: string): boolean {
  return fileKey.startsWith(prefix) && !fileKey.split('/').includes('..');
}

/**
 * Reject a submission whose files were not uploaded for this type — otherwise
 * a caller could submit another org's fileKey and have it presigned on read.
 */
export function assertFileKeysBelongToType(params: {
  data: Record<string, unknown>;
  organizationId: string;
  typeId: string;
}): void {
  const prefix = customDocumentFilePrefix(params);
  for (const [, file] of fileEntries(params.data)) {
    if (!isKeyUnder(file.fileKey, prefix)) {
      throw new BadRequestException(
        'Submitted file was not uploaded for this document type',
      );
    }
  }
}

/**
 * Drop client-sent download URLs before storing. They expire, and a client
 * could send any link; reads presign a fresh URL from the fileKey instead.
 */
export function withoutDownloadUrls(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const stored: Record<string, unknown> = { ...data };
  for (const [key, file] of fileEntries(data)) {
    const { downloadUrl: _downloadUrl, ...rest } = file;
    stored[key] = rest;
  }
  return stored;
}

/** Attach fresh presigned download URLs to every file in the record. */
export async function refreshFileUrls(params: {
  data: Record<string, unknown>;
  organizationId: string;
  presign: (fileKey: string) => Promise<string>;
}): Promise<Record<string, unknown>> {
  const refreshed: Record<string, unknown> = { ...params.data };
  const orgPrefix = `${params.organizationId}/`;
  for (const [key, file] of fileEntries(params.data)) {
    refreshed[key] = {
      ...file,
      downloadUrl: isKeyUnder(file.fileKey, orgPrefix)
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
