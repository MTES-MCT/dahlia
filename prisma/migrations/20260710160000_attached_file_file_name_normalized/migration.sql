-- Replace originalFileNameNormalized with fileNameNormalized for accent-insensitive
-- search on the editable display name (fileName) rather than the Télérecours original.

ALTER TABLE "attached_files" DROP COLUMN IF EXISTS "originalFileNameNormalized";
ALTER TABLE "attached_files" ADD COLUMN "fileNameNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent("fileName"))) STORED;
