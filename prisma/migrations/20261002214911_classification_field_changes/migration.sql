-- AlterEnum
ALTER TYPE "RightType" ADD VALUE 'NI_DALO_NI_DAHO';

-- CreateTable
CREATE TABLE "classification_field_changes" (
    "id" SERIAL NOT NULL,
    "caseFileNumber" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_field_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "classification_field_changes_caseFileNumber_changedAt_idx" ON "classification_field_changes"("caseFileNumber", "changedAt");

-- AddForeignKey
ALTER TABLE "classification_field_changes" ADD CONSTRAINT "classification_field_changes_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
