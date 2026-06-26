-- AlterTable
ALTER TABLE "case_file_events"
ALTER COLUMN "piecesNonDownloadable" TYPE BOOLEAN
USING (
  CASE
    WHEN "piecesNonDownloadable" IS NULL THEN NULL
    WHEN LOWER("piecesNonDownloadable") IN ('true', 't', '1', 'yes') THEN true
    ELSE false
  END
);
