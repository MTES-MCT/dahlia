-- Normalized search columns for server-side table filtering (pièces, historique).
-- Reuses f_unaccent from migration search_unaccent.

-- Measure label (historique « événement » column).
ALTER TABLE "measures" DROP COLUMN IF EXISTS "labelNormalized";
ALTER TABLE "measures" ADD COLUMN "labelNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent("label"))) STORED;

-- Denormalized family label on attached files (GENERATED columns cannot join).
ALTER TABLE "attached_files" ADD COLUMN IF NOT EXISTS "fileFamilyTypeLabel" TEXT;

UPDATE "attached_files" af
SET "fileFamilyTypeLabel" = fft.label
FROM "file_family_types" fft
WHERE af."fileFamilyTypeCode" = fft.code;

ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "nameSearchNormalized";
ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "typeSearchNormalized";

ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "dahliaNameNormalized";
ALTER TABLE "attached_files" ADD COLUMN "dahliaNameNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent(coalesce(trim("dahliaName"), '')))) STORED;

ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "originalFileNameNormalized";
ALTER TABLE "attached_files" ADD COLUMN "originalFileNameNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent("originalFileName"))) STORED;

ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "fileTypeLabelNormalized";
ALTER TABLE "attached_files" ADD COLUMN "fileTypeLabelNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent("fileTypeLabel"))) STORED;

ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "fileFamilyTypeLabelNormalized";
ALTER TABLE "attached_files" ADD COLUMN "fileFamilyTypeLabelNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent(coalesce("fileFamilyTypeLabel", '')))) STORED;

-- Case file event comment and deadline (historique columns).
ALTER TABLE "case_file_events" DROP COLUMN IF EXISTS "commentSearchNormalized";
ALTER TABLE "case_file_events" ADD COLUMN "commentSearchNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent(coalesce("comment", '')))) STORED;

ALTER TABLE "case_file_events" DROP COLUMN IF EXISTS "deadlineLabelSearchNormalized";
ALTER TABLE "case_file_events" ADD COLUMN "deadlineLabelSearchNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent(coalesce("deadlineLabel", '')))) STORED;
