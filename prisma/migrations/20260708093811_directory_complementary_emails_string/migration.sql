-- AlterTable
ALTER TABLE "case_files" ALTER COLUMN "directoryComplementaryEmails" DROP DEFAULT;
ALTER TABLE "case_files" ALTER COLUMN "directoryComplementaryEmails" TYPE TEXT USING (
  CASE
    WHEN "directoryComplementaryEmails" IS NULL OR cardinality("directoryComplementaryEmails") = 0 THEN NULL
    ELSE array_to_string("directoryComplementaryEmails", ';')
  END
);
