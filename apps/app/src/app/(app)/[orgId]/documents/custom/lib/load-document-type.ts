import 'server-only';

import { serverApi } from '@/lib/api-server';
import { notFound } from 'next/navigation';
import type { CustomDocumentType } from '../hooks/use-custom-documents';

/** Fetch a custom document type for a server page, or render the 404 page. */
export async function loadDocumentType(typeId: string): Promise<CustomDocumentType> {
  const response = await serverApi.get<CustomDocumentType>(
    `/v1/custom-documents/types/${encodeURIComponent(typeId)}`,
  );
  if (response.error || !response.data) notFound();
  return response.data;
}

