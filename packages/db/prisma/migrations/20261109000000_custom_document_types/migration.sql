-- CreateTable
CREATE TABLE "DocumentSection" (
    "id" TEXT NOT NULL DEFAULT generate_prefixed_cuid('dsc'::text),
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomDocumentType" (
    "id" TEXT NOT NULL DEFAULT generate_prefixed_cuid('cdt'::text),
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sectionId" TEXT,
    "builtInCategory" TEXT,
    "fields" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomDocumentSubmission" (
    "id" TEXT NOT NULL DEFAULT generate_prefixed_cuid('cds'::text),
    "organizationId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDocumentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentSection_organizationId_idx" ON "DocumentSection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSection_organizationId_name_key" ON "DocumentSection"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CustomDocumentType_organizationId_idx" ON "CustomDocumentType"("organizationId");

-- CreateIndex
CREATE INDEX "CustomDocumentType_sectionId_idx" ON "CustomDocumentType"("sectionId");

-- CreateIndex
CREATE INDEX "CustomDocumentSubmission_organizationId_documentTypeId_subm_idx" ON "CustomDocumentSubmission"("organizationId", "documentTypeId", "submittedAt");

-- AddForeignKey
ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentType" ADD CONSTRAINT "CustomDocumentType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentType" ADD CONSTRAINT "CustomDocumentType_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DocumentSection"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentType" ADD CONSTRAINT "CustomDocumentType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentSubmission" ADD CONSTRAINT "CustomDocumentSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentSubmission" ADD CONSTRAINT "CustomDocumentSubmission_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "CustomDocumentType"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentSubmission" ADD CONSTRAINT "CustomDocumentSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDocumentSubmission" ADD CONSTRAINT "CustomDocumentSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
