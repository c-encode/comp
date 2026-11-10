import { PERMISSIONS_KEY } from '@/auth/permission.guard';
import { CustomDocumentSubmissionsController } from './custom-document-submissions.controller';
import { CustomDocumentTypesController } from './custom-document-types.controller';

jest.mock('@/auth/hybrid-auth.guard', () => ({ HybridAuthGuard: class {} }));
jest.mock('@/auth/permission.guard', () => ({
  PermissionGuard: class {},
  PERMISSIONS_KEY: 'permissions',
}));
jest.mock('@/auth/acting-user.service', () => ({
  ActingUserResolver: class {},
}));
jest.mock('./custom-document-sections.service', () => ({
  CustomDocumentSectionsService: class {},
}));
jest.mock('./custom-document-types.service', () => ({
  CustomDocumentTypesService: class {},
}));
jest.mock('./custom-document-submissions.service', () => ({
  CustomDocumentSubmissionsService: class {},
}));

function permissionOf(controller: { prototype: object }, method: string) {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  return Reflect.getMetadata(PERMISSIONS_KEY, handler as object);
}

describe('custom document endpoints RBAC', () => {
  it.each([
    ['listSections', 'read'],
    ['createSection', 'create'],
    ['updateSection', 'update'],
    ['deleteSection', 'delete'],
    ['listTypes', 'read'],
    ['createType', 'create'],
    ['getType', 'read'],
    ['updateType', 'update'],
    ['deleteType', 'delete'],
  ])('types controller %s requires evidence:%s', (method, action) => {
    expect(permissionOf(CustomDocumentTypesController, method)).toEqual([
      { resource: 'evidence', actions: [action] },
    ]);
  });

  it.each([
    ['list', 'read'],
    ['get', 'read'],
    ['upload', 'create'],
    ['submit', 'create'],
    ['review', 'update'],
    ['remove', 'delete'],
  ])('submissions controller %s requires evidence:%s', (method, action) => {
    expect(permissionOf(CustomDocumentSubmissionsController, method)).toEqual([
      { resource: 'evidence', actions: [action] },
    ]);
  });
});

describe('controller delegation', () => {
  it('passes the acting user to type creation', async () => {
    const types = { create: jest.fn().mockResolvedValue({ id: 'cdt_1' }) };
    const actingUser = {
      resolve: jest.fn().mockResolvedValue({ userId: 'usr_1' }),
    };
    const controller = new CustomDocumentTypesController(
      {} as never,
      types as never,
      actingUser as never,
    );
    // The service gets the raw request body, not the pipe-transformed DTO.
    const rawBody = {
      title: 'T',
      builtInCategory: 'Security',
      fields: [{ key: 'doc' }],
    };
    await controller.createType('org_1', { title: 'mangled', fields: [] }, {
      body: rawBody,
    } as never);
    expect(types.create).toHaveBeenCalledWith({
      organizationId: 'org_1',
      userId: 'usr_1',
      payload: rawBody,
    });
  });

  it('refuses a review that cannot be attributed to a user', async () => {
    const submissions = { review: jest.fn() };
    const actingUser = {
      resolve: jest.fn().mockResolvedValue({ userId: null }),
    };
    const controller = new CustomDocumentSubmissionsController(
      submissions as never,
      actingUser as never,
    );
    await expect(
      controller.review(
        'org_1',
        'cdt_1',
        'cds_1',
        { action: 'approved' },
        {} as never,
      ),
    ).rejects.toThrow('owner');
    expect(submissions.review).not.toHaveBeenCalled();
  });
});
