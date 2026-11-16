-- CreateEnum
CREATE TYPE "InterpretationStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "attached_file_interpretations" (
    "id" SERIAL NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "encodedFileId" TEXT NOT NULL,
    "status" "InterpretationStatus" NOT NULL,
    "documentType" TEXT,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "rawResult" JSONB,
    "errorMessage" TEXT,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attached_file_interpretations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attached_file_interpretations_documentType_idx" ON "attached_file_interpretations"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "attached_file_interpretations_jurisdictionCode_encodedFileI_key" ON "attached_file_interpretations"("jurisdictionCode", "encodedFileId");

-- AddForeignKey
ALTER TABLE "attached_file_interpretations" ADD CONSTRAINT "attached_file_interpretations_jurisdictionCode_encodedFile_fkey" FOREIGN KEY ("jurisdictionCode", "encodedFileId") REFERENCES "attached_files"("jurisdictionCode", "encodedFileId") ON DELETE CASCADE ON UPDATE CASCADE;
