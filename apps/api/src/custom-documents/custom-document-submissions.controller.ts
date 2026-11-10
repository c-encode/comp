import { ActingUserResolver } from '@/auth/acting-user.service';
import { OrganizationId } from '@/auth/auth-context.decorator';
import { HybridAuthGuard } from '@/auth/hybrid-auth.guard';
import { PermissionGuard } from '@/auth/permission.guard';
import { RequirePermission } from '@/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '@/auth/types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CustomDocumentSubmissionsService } from './custom-document-submissions.service';
import {
  ReviewCustomDocumentSubmissionDto,
  SubmitCustomDocumentDto,
  UploadCustomDocumentFileDto,
} from './dto/custom-documents.dto';

@ApiTags('Custom Documents')
@Controller({ path: 'custom-documents/types/:typeId', version: '1' })
@UseGuards(HybridAuthGuard, PermissionGuard)
@ApiSecurity('apikey')
@ApiHeader({
  name: 'X-Organization-Id',
  description:
    'Organization ID (required for session auth, optional for API key auth)',
  required: false,
})
export class CustomDocumentSubmissionsController {
  constructor(
    private readonly submissions: CustomDocumentSubmissionsService,
    private readonly actingUser: ActingUserResolver,
  ) {}

  @Get('submissions')
  @RequirePermission('evidence', 'read')
  @ApiExtension('x-speakeasy-mcp', { name: 'list-custom-document-submissions' })
  @ApiOperation({
    summary: 'List custom document submissions',
    description:
      'Lists archived records for one custom document type, newest first, with fresh file download links. Supports search, limit and offset.',
  })
  list(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.submissions.list({
      organizationId,
      typeId,
      search,
      limit,
      offset,
    });
  }

  @Post('uploads')
  @RequirePermission('evidence', 'create')
  @ApiExtension('x-speakeasy-mcp', { name: 'upload-custom-document-file' })
  @ApiOperation({
    summary: 'Upload a file for a custom document',
    description:
      'Stores a file for a custom document file field and returns the object to put in the submission data. AI clients pass s3Key from /v1/uploads/presign.',
  })
  @ApiBody({ type: UploadCustomDocumentFileDto })
  upload(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Body() body: UploadCustomDocumentFileDto,
  ) {
    return this.submissions.uploadFile({
      organizationId,
      typeId,
      payload: body,
    });
  }

  @Post('submissions')
  @RequirePermission('evidence', 'create')
  @ApiExtension('x-speakeasy-mcp', { name: 'submit-custom-document' })
  @ApiOperation({
    summary: 'Submit a custom document',
    description:
      'Archives a new record for a custom document type. data holds submissionDate plus one value per field key; it is validated against the type.',
  })
  @ApiBody({ type: SubmitCustomDocumentDto })
  async submit(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Body() _body: SubmitCustomDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const acting = await this.actingUser.resolve(req, organizationId);
    // Raw body: the ValidationPipe transform mangles nested JSON (file objects).
    return this.submissions.submit({
      organizationId,
      typeId,
      userId: acting.userId,
      payload: req.body,
    });
  }

  @Get('submissions/:submissionId')
  @RequirePermission('evidence', 'read')
  @ApiExtension('x-speakeasy-mcp', { name: 'get-custom-document-submission' })
  @ApiOperation({
    summary: 'Get a custom document submission',
    description:
      'Returns one archived custom document record with its type definition and fresh file links.',
  })
  get(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissions.get({ organizationId, typeId, submissionId });
  }

  @Patch('submissions/:submissionId/review')
  @RequirePermission('evidence', 'update')
  @ApiExtension('x-speakeasy-mcp', {
    name: 'review-custom-document-submission',
  })
  @ApiOperation({
    summary: 'Review a custom document submission',
    description:
      'Approves or rejects a pending custom document record. A reason is required to reject.',
  })
  @ApiBody({ type: ReviewCustomDocumentSubmissionDto })
  async review(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: ReviewCustomDocumentSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const acting = await this.actingUser.resolve(req, organizationId);
    if (!acting.userId) {
      throw new BadRequestException(
        'Cannot attribute this review — your organization must have at least one user with the "owner" role.',
      );
    }
    return this.submissions.review({
      organizationId,
      typeId,
      submissionId,
      reviewerUserId: acting.userId,
      payload: body,
    });
  }

  @Delete('submissions/:submissionId')
  @RequirePermission('evidence', 'delete')
  @ApiExtension('x-speakeasy-mcp', {
    name: 'delete-custom-document-submission',
  })
  @ApiOperation({
    summary: 'Delete a custom document submission',
    description: 'Permanently deletes one archived custom document record.',
  })
  remove(
    @OrganizationId() organizationId: string,
    @Param('typeId') typeId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissions.remove({ organizationId, typeId, submissionId });
  }
}
