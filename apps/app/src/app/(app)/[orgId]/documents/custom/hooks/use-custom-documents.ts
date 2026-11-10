'use client';

import { apiClient } from '@/lib/api-client';
import type { CustomDocumentField } from '@trycompai/company';
import useSWR from 'swr';

export type { CustomDocumentField };

export interface DocumentSection {
  id: string;
  name: string;
  position: number;
  documentTypeCount: number;
}

export interface DocumentSectionsResponse {
  builtInSections: string[];
  sections: DocumentSection[];
}

export interface CustomDocumentType {
  id: string;
  title: string;
  description: string;
  sectionId: string | null;
  builtInCategory: string | null;
  section: { id: string; name: string } | null;
  fields: CustomDocumentField[];
  submissionCount: number;
  lastSubmittedAt: string | null;
}

interface SubmissionUser {
  id: string;
  name: string | null;
  email: string;
}

export interface CustomDocumentSubmission {
  id: string;
  documentTypeId: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, unknown>;
  reviewReason: string | null;
  reviewedAt: string | null;
  submittedBy: SubmissionUser | null;
  reviewedBy: SubmissionUser | null;
}

export interface CustomDocumentFile {
  fileName: string;
  fileKey: string;
  downloadUrl: string;
}

export const CUSTOM_DOCUMENTS_BASE = '/v1/custom-documents';

export const sectionsKey = (organizationId: string) =>
  [`${CUSTOM_DOCUMENTS_BASE}/sections`, organizationId] as const;
export const typesKey = (organizationId: string) =>
  [`${CUSTOM_DOCUMENTS_BASE}/types`, organizationId] as const;
export const typeKey = (params: { organizationId: string; typeId: string }) =>
  [`${CUSTOM_DOCUMENTS_BASE}/types/${params.typeId}`, params.organizationId] as const;
export const submissionsKey = (params: { organizationId: string; typeId: string }) =>
  [`${CUSTOM_DOCUMENTS_BASE}/types/${params.typeId}/submissions`, params.organizationId] as const;
export const submissionKey = (params: {
  organizationId: string;
  typeId: string;
  submissionId: string;
}) =>
  [
    `${CUSTOM_DOCUMENTS_BASE}/types/${params.typeId}/submissions/${params.submissionId}`,
    params.organizationId,
  ] as const;

async function fetcher<T>([endpoint, organizationId]: readonly [string, string]): Promise<T> {
  const response = await apiClient.get<T>(endpoint, organizationId);
  if (response.error || response.data === undefined) {
    throw new Error(response.error ?? 'Request failed');
  }
  return response.data;
}

/** Unwrap an apiClient response or throw its error message (for toasts). */
export function unwrap<T>(response: { data?: T; error?: string }): T {
  if (response.error || response.data === undefined) {
    throw new Error(response.error ?? 'Request failed');
  }
  return response.data;
}

export function useDocumentSections(organizationId: string) {
  return useSWR<DocumentSectionsResponse>(sectionsKey(organizationId), fetcher);
}

export function useCustomDocumentTypes(organizationId: string) {
  return useSWR<CustomDocumentType[]>(typesKey(organizationId), fetcher);
}

export function useCustomDocumentSubmissions(params: { organizationId: string; typeId: string }) {
  return useSWR<{
    documentType: CustomDocumentType;
    submissions: CustomDocumentSubmission[];
    total: number;
  }>(submissionsKey(params), fetcher);
}

export function useCustomDocumentSubmission(params: {
  organizationId: string;
  typeId: string;
  submissionId: string;
}) {
  return useSWR<{ documentType: CustomDocumentType; submission: CustomDocumentSubmission }>(
    submissionKey(params),
    fetcher,
  );
}
