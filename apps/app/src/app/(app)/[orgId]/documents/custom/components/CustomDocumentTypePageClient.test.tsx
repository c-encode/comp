import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  AUDITOR_PERMISSIONS,
  mockHasPermission,
  setMockPermissions,
} from '@/test-utils/mocks/permissions';

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ permissions: {}, hasPermission: mockHasPermission }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const submissionsState: { data: unknown } = { data: undefined };
vi.mock('../hooks/use-custom-documents', () => ({
  useCustomDocumentSubmissions: () => ({ data: submissionsState.data, error: null, isLoading: false }),
  useDocumentSections: () => ({ data: undefined }),
  CUSTOM_DOCUMENTS_BASE: '/v1/custom-documents',
  sectionsKey: vi.fn(),
  typesKey: vi.fn(),
  unwrap: vi.fn(),
}));

vi.mock('./DeleteDocumentTypeButton', () => ({
  DeleteDocumentTypeButton: () => <button>Delete type</button>,
}));
vi.mock('./SectionDialog', () => ({ SectionDialog: () => null }));

type Props = { children?: ReactNode; [key: string]: unknown };
vi.mock('@trycompai/design-system', () => ({
  Badge: ({ children }: Props) => <span>{children}</span>,
  Button: ({ children, onClick }: Props) => (
    <button onClick={onClick as () => void}>{children}</button>
  ),
  Empty: ({ children }: Props) => <div>{children}</div>,
  EmptyDescription: ({ children }: Props) => <p>{children}</p>,
  EmptyHeader: ({ children }: Props) => <div>{children}</div>,
  EmptyTitle: ({ children }: Props) => <h3>{children}</h3>,
  HStack: ({ children }: Props) => <div>{children}</div>,
  PageHeader: ({ title, actions }: Props) => (
    <div>
      <h1>{title as string}</h1>
      {actions as ReactNode}
    </div>
  ),
  Stack: ({ children }: Props) => <div>{children}</div>,
  Table: ({ children }: Props) => <table>{children}</table>,
  TableBody: ({ children }: Props) => <tbody>{children}</tbody>,
  TableCell: ({ children }: Props) => <td>{children}</td>,
  TableHead: ({ children }: Props) => <th>{children}</th>,
  TableHeader: ({ children }: Props) => <thead>{children}</thead>,
  TableRow: ({ children }: Props) => <tr>{children}</tr>,
  Text: ({ children }: Props) => <span>{children}</span>,
}));
vi.mock('@trycompai/design-system/icons', () => ({ Add: () => null, Edit: () => null }));

import { CustomDocumentTypePageClient } from './CustomDocumentTypePageClient';
import { ManageDocumentsToolbar } from './ManageDocumentsToolbar';

const documentType = {
  id: 'cdt_1',
  title: 'Architecture Diagram',
  description: 'System architecture and PHI data flow',
  sectionId: 'dsc_1',
  builtInCategory: null,
  section: { id: 'dsc_1', name: 'Architecture' },
  fields: [{ key: 'document', label: 'Document', type: 'file', required: true }],
  submissionCount: 1,
  lastSubmittedAt: '2026-11-06T00:00:00.000Z',
};

const submission = {
  id: 'cds_1',
  documentTypeId: 'cdt_1',
  submittedAt: '2026-11-06T19:16:50.497Z',
  status: 'pending',
  data: {
    submissionDate: '2026-11-06',
    document: { fileName: 'architecture.pdf', fileKey: 'org/a.pdf', downloadUrl: 'https://s3/a.pdf' },
  },
  reviewReason: null,
  reviewedAt: null,
  submittedBy: { id: 'usr_1', name: 'Farbod', email: 'f@example.com' },
  reviewedBy: null,
};

beforeEach(() => {
  submissionsState.data = { documentType, submissions: [submission], total: 1 };
});

describe('CustomDocumentTypePageClient', () => {
  it('lists records with their file and gives admins create and edit actions', () => {
    setMockPermissions(ADMIN_PERMISSIONS);
    render(<CustomDocumentTypePageClient organizationId="org_1" typeId="cdt_1" />);

    expect(screen.getByText('Architecture Diagram')).toBeInTheDocument();
    expect(screen.getByText('architecture.pdf')).toBeInTheDocument();
    expect(screen.getByText('11/06/2026')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('New record')).toBeInTheDocument();
    expect(screen.getByText('Edit type')).toBeInTheDocument();
    // A type with records cannot be deleted, so the button is not offered.
    expect(screen.queryByText('Delete type')).not.toBeInTheDocument();
  });

  it('is read-only for auditors', () => {
    setMockPermissions(AUDITOR_PERMISSIONS);
    render(<CustomDocumentTypePageClient organizationId="org_1" typeId="cdt_1" />);

    expect(screen.getByText('architecture.pdf')).toBeInTheDocument();
    expect(screen.queryByText('New record')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit type')).not.toBeInTheDocument();
  });

  it('offers delete for an empty type and shows the empty state', () => {
    setMockPermissions(ADMIN_PERMISSIONS);
    submissionsState.data = { documentType: { ...documentType, submissionCount: 0 }, submissions: [], total: 0 };
    render(<CustomDocumentTypePageClient organizationId="org_1" typeId="cdt_1" />);

    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByText('Delete type')).toBeInTheDocument();
  });
});

describe('ManageDocumentsToolbar', () => {
  it('shows section and type creation to admins', () => {
    setMockPermissions(ADMIN_PERMISSIONS);
    render(<ManageDocumentsToolbar organizationId="org_1" />);
    expect(screen.getByText('New section')).toBeInTheDocument();
    expect(screen.getByText('New document type')).toBeInTheDocument();
  });

  it('is hidden for read-only users', () => {
    setMockPermissions(AUDITOR_PERMISSIONS);
    const { container } = render(<ManageDocumentsToolbar organizationId="org_1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
