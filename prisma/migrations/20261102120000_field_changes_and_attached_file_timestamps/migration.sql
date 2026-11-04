-- Generic field-change audit trail (ex classification_field_changes) and
-- timestamps on attached files. Hand-written: the generated diff drops and
-- recreates the history table, and adds spurious DROP DEFAULT statements on
-- GENERATED columns (see CLAUDE.md).

-- ─── 1. classification_field_changes → field_changes ───

CREATE TYPE "FieldChangeModel" AS ENUM ('CaseFile', 'AttachedFile');

ALTER TABLE "classification_field_changes" DROP CONSTRAINT "classification_field_changes_jurisdictionCode_caseFileNumb_fkey";
DROP INDEX "classification_field_changes_jurisdictionCode_caseFileNumbe_idx";

ALTER TABLE "classification_field_changes" RENAME TO "field_changes";
ALTER TABLE "field_changes" RENAME CONSTRAINT "classification_field_changes_pkey" TO "field_changes_pkey";
ALTER SEQUENCE "classification_field_changes_id_seq" RENAME TO "field_changes_id_seq";

-- Existing rows all target case files and were written by the classifier.
ALTER TABLE "field_changes" ADD COLUMN "model" "FieldChangeModel";
ALTER TABLE "field_changes" RENAME COLUMN "caseFileNumber" TO "modelId";
ALTER TABLE "field_changes" RENAME COLUMN "ruleId" TO "origin";
UPDATE "field_changes" SET "model" = 'CaseFile';
ALTER TABLE "field_changes" ALTER COLUMN "model" SET NOT NULL;

CREATE INDEX "field_changes_jurisdictionCode_model_modelId_changedAt_idx" ON "field_changes"("jurisdictionCode", "model", "modelId", "changedAt");
CREATE INDEX "field_changes_jurisdictionCode_model_modelId_field_changedA_idx" ON "field_changes"("jurisdictionCode", "model", "modelId", "field", "changedAt");

-- ─── 2. attached_files timestamps ───

ALTER TABLE "attached_files" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "telerecoursUpdatedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Best known date for pièces imported before this migration.
UPDATE "attached_files"
SET "createdAt" = "eventCreationDate",
    "updatedAt" = "eventCreationDate",
    "telerecoursUpdatedAt" = "eventCreationDate";
