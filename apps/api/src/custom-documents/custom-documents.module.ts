import { AttachmentsModule } from '@/attachments/attachments.module';
import { AuthModule } from '@/auth/auth.module';
import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { CustomDocumentSectionsService } from './custom-document-sections.service';
import { CustomDocumentSubmissionsController } from './custom-document-submissions.controller';
import { CustomDocumentSubmissionsService } from './custom-document-submissions.service';
import { CustomDocumentTypesController } from './custom-document-types.controller';
import { CustomDocumentTypesService } from './custom-document-types.service';

@Module({
  imports: [AuthModule, AttachmentsModule, UploadsModule],
  controllers: [
    CustomDocumentTypesController,
    CustomDocumentSubmissionsController,
  ],
  providers: [
    CustomDocumentSectionsService,
    CustomDocumentTypesService,
    CustomDocumentSubmissionsService,
  ],
})
export class CustomDocumentsModule {}
