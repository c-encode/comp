import { ActingUserResolver } from '@/auth/acting-user.service';
import { OrganizationId } from '@/auth/auth-context.decorator';
import { HybridAuthGuard } from '@/auth/hybrid-auth.guard';
import { PermissionGuard } from '@/auth/permission.guard';
import { RequirePermission } from '@/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '@/auth/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExtension,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CustomDocumentSectionsService } from './custom-document-sections.service';
import { CustomDocumentTypesService } from './custom-document-types.service';
import {
  CreateCustomDocumentTypeDto,
  CreateDocumentSectionDto,
  UpdateCustomDocumentTypeDto,
  UpdateDocumentSectionDto,
} from './dto/custom-documents.dto';

@ApiTags('Custom Documents')
@Controller({ path: 'custom-documents', version: '1' })
@UseGuards(HybridAuthGuard, PermissionGuard)
@ApiSecurity('apikey')
@ApiHeader({
  name: 'X-Organization-Id',
  description:
    'Organization ID (required for session auth, optional for API key auth)',
  required: false,
})
export class CustomDocumentTypesController {
  constructor(
    private readonly sections: CustomDocumentSectionsService,
    private readonly types: CustomDocumentTypesService,
    private readonly actingUser: ActingUserResolver,
  ) {}

  @Get('sections')
  @RequirePermission('evidence', 'read')
  @ApiExtension('x-speakeasy-mcp', { name: 'list-document-sections' })
  @ApiOperation({
    summary: 'List document sections',
    description:
      'Lists the built-in and custom section headings on the Documents page. Use before creating a document type to pick its section.',
  })
  listSections(@OrganizationId() organizationId: string) {
    return this.sections.list(organizationId);
  }

  @Post('sections')
  @RequirePermission('evidence', 'create')
  @ApiExtension('x-speakeasy-mcp', { name: 'create-document-section' })
  @ApiOperation({
    summary: 'Create a document section',
    description:
      'Adds a custom section heading to the Documents page for grouping custom document types.',
  })
  @ApiBody({ type: CreateDocumentSectionDto })
  createSection(
    @OrganizationId() organizationId: string,
    @Body() body: CreateDocumentSectionDto,
  ) {
    return this.sections.create({ organizationId, payload: body });
  }

  @Patch('sections/:sectionId')
  @RequirePermission('evidence', 'update')
  @ApiExtension('x-speakeasy-mcp', { name: 'update-document-section' })
  @ApiOperation({
    summary: 'Rename or reorder a document section',
    description:
      'Renames a custom Documents section or changes its sort position.',
  })
  @ApiBody({ type: UpdateDocumentSectionDto })
  updateSection(
    @OrganizationId() organizationId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: UpdateDocumentSectionDto,
  ) {
    return this.sections.update({ organizationId, sectionId, payload: body });
  }

  @Delete('sections/:sectionId')
  @RequirePermission('evidence', 'delete')
  @ApiExtension('x-speakeasy-mcp', { name: 'delete-document-section' })
  @ApiOperation({
    summary: 'Delete a document section',
    description:
      'Deletes an empty custom Documents section. Move or delete its document types first.',
  })
  deleteSection(
    @OrganizationId() organizationId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.sections.remove({ organizationId, sectionId });
  }

  @Get('types')
  @RequirePermission('evidence', 'read')
  @ApiExtension('x-speakeasy-mcp', { name: 'list-custom-document-types' })
  @ApiOperation({
    summary: 'List custom document types',
    description:
      'Lists organization-defined document types with their fields, section, submission count and last submission date.',
  })
  listTypes(@OrganizationId() organizationId: string) {
    return this.types.list(organizationId);
  }

  @Post('types')
  @RequirePermission('evidence', 'create')
  @ApiExtension('x-speakeasy-mcp', { name: 'create-custom-document-type' })
  @ApiOperation({
    summary: 'Create a custom document type',
    description:
      'Defines a new document type (e.g. Architecture Diagram) with its fields and section, so records can be archived under Documents.',
  })
  @ApiBody({ type: CreateCustomDocumentTypeDto })
  async createType(
    @OrganizationId() organizationId: string,
    @Body() _body: CreateCustomDocumentTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const acting = await this.actingUser.resolve(req, organizationId);
    // Raw body: the ValidationPipe transform mangles the nested fields array.
    return this.types.create({
      organizationId,
      userId: acting.userId,
      payload: req.body,
    });
  }

  @Get('types/:typeId')
  @RequirePermission('evidence', 'read')
  @ApiExtension('x-speakeasy-mcp', { name: 'get-custom-document-type' })
  @ApiOperation({
    summary: 'Get a custom document type',
    description:
      'Returns one custom document type with its field definitions. Use to build a valid submission.',
  })
  getType(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
  ) {
    return this.types.get({ organizationId, typeId });
  }

  @Patch('types/:typeId')
  @RequirePermission('evidence', 'update')
  @ApiExtension('x-speakeasy-mcp', { name: 'update-custom-document-type' })
  @ApiOperation({
    summary: 'Update a custom document type',
    description:
      'Changes a custom document type title, description, section or fields. Keep existing field keys so past submissions stay readable.',
  })
  @ApiBody({ type: UpdateCustomDocumentTypeDto })
  updateType(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Body() _body: UpdateCustomDocumentTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // Raw body: the ValidationPipe transform mangles the nested fields array.
    return this.types.update({ organizationId, typeId, payload: req.body });
  }

  @Delete('types/:typeId')
  @RequirePermission('evidence', 'delete')
  @ApiExtension('x-speakeasy-mcp', { name: 'delete-custom-document-type' })
  @ApiOperation({
    summary: 'Delete a custom document type',
    description:
      'Deletes a custom document type that has no submissions. Delete its submissions first.',
  })
  deleteType(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
  ) {
    return this.types.remove({ organizationId, typeId });
  }
}
