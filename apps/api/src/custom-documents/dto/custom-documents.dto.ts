import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// These DTOs describe the bodies for OpenAPI/MCP and pass the global
// ValidationPipe. Controllers hand the services the raw req.body (the pipe's
// transform mangles nested JSON such as the fields array), and the services
// validate it fully with the shared Zod schemas from @trycompai/company.

export class CreateDocumentSectionDto {
  @ApiProperty({
    description: 'Section heading shown on the Documents page',
    example: 'Architecture',
  })
  @IsString()
  name!: string;
}

export class UpdateDocumentSectionDto {
  @ApiPropertyOptional({
    description: 'New section heading',
    example: 'Architecture & Data Flow',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Sort position; lower comes first',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CustomDocumentFieldOptionDto {
  @ApiProperty({ example: 'Production' })
  label!: string;

  @ApiProperty({ example: 'production' })
  value!: string;
}

export class CustomDocumentFieldDto {
  @ApiProperty({
    description:
      'Stable key under which the value is stored. Letters, digits, _; starts with a letter.',
    example: 'diagramFile',
  })
  key!: string;

  @ApiProperty({ example: 'Diagram file' })
  label!: string;

  @ApiProperty({
    enum: ['text', 'textarea', 'date', 'select', 'file'],
    example: 'file',
  })
  type!: string;

  @ApiProperty({ example: true })
  required!: boolean;

  @ApiPropertyOptional({ example: 'PDF or PNG export of the diagram' })
  description?: string;

  @ApiPropertyOptional({
    type: [CustomDocumentFieldOptionDto],
    description: 'Required for select fields',
  })
  options?: CustomDocumentFieldOptionDto[];
}

export class CreateCustomDocumentTypeDto {
  @ApiProperty({ example: 'Architecture & Data Flow Diagram' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'System architecture and PHI data flow, reviewed yearly.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Custom section id. Set this or builtInCategory.',
    example: 'dsc_abc123',
  })
  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @ApiPropertyOptional({
    description:
      'Built-in section name (Governance, Security, People). Set this or sectionId.',
    example: 'Security',
  })
  @IsOptional()
  @IsString()
  builtInCategory?: string | null;

  @ApiProperty({
    type: [CustomDocumentFieldDto],
    description: 'Fields collected on each submission',
  })
  @IsArray()
  fields!: CustomDocumentFieldDto[];
}

export class UpdateCustomDocumentTypeDto {
  @ApiPropertyOptional({ example: 'Architecture & Data Flow Diagram' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'System architecture and PHI data flow.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Custom section id. Send with builtInCategory: null to move.',
    example: 'dsc_abc123',
  })
  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @ApiPropertyOptional({
    description: 'Built-in section name. Send with sectionId: null to move.',
    example: 'Security',
  })
  @IsOptional()
  @IsString()
  builtInCategory?: string | null;

  @ApiPropertyOptional({
    type: [CustomDocumentFieldDto],
    description:
      'Replaces the field list. Keep existing keys so past submissions stay readable.',
  })
  @IsOptional()
  @IsArray()
  fields?: CustomDocumentFieldDto[];
}

export class SubmitCustomDocumentDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'submissionDate (YYYY-MM-DD) plus one value per field key. File fields take the object returned by the upload endpoint.',
    example: { submissionDate: '2026-11-09', notes: 'Reviewed by SPO' },
  })
  @IsObject()
  data!: Record<string, unknown>;
}

export class ReviewCustomDocumentSubmissionDto {
  @ApiProperty({ enum: ['approved', 'rejected'], example: 'approved' })
  @IsString()
  action!: string;

  @ApiPropertyOptional({
    description: 'Required when rejecting',
    example: 'Diagram is out of date',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UploadCustomDocumentFileDto {
  @ApiProperty({ example: 'architecture.pdf' })
  @IsString()
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  fileType!: string;

  @ApiPropertyOptional({
    description: 'Base64 file content — web UI only. AI clients use s3Key.',
  })
  @IsOptional()
  @IsString()
  fileData?: string;

  @ApiPropertyOptional({
    description: 'Key returned by /v1/uploads/presign.',
    example: 'org_x/uploads/file.pdf',
  })
  @IsOptional()
  @IsString()
  s3Key?: string;
}
