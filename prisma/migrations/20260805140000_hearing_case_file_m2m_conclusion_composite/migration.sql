-- Hearing ↔ CaseFile becomes M2M via case_file_hearings.
-- Conclusion PK becomes (id, hearingId); Hearing.lastConclusion uses a composite FK.
-- Existing hearing/conclusion rows are wiped: a full rescrape is expected.

-- DropForeignKey
ALTER TABLE "hearings" DROP CONSTRAINT "hearings_caseFileNumber_fkey";
ALTER TABLE "hearings" DROP CONSTRAINT "hearings_lastConclusionId_fkey";
ALTER TABLE "case_files" DROP CONSTRAINT IF EXISTS "case_files_lastHearingId_fkey";

-- DropIndex
DROP INDEX "hearings_caseFileNumber_idx";
DROP INDEX "hearings_lastConclusionId_key";

-- Wipe dependent data (no backfill; rescrape from scratch)
UPDATE "case_files" SET "lastHearingId" = NULL, "lastHearingConvocationDate" = NULL;
DELETE FROM "hearings";
DELETE FROM "conclusions";

-- AlterTable conclusions: composite PK (id, hearingId)
ALTER TABLE "conclusions" DROP CONSTRAINT "conclusions_pkey";
ALTER TABLE "conclusions" ADD COLUMN "hearingId" TEXT NOT NULL;
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_pkey" PRIMARY KEY ("id", "hearingId");

-- AlterTable hearings: drop ownership column
ALTER TABLE "hearings" DROP COLUMN "caseFileNumber";

-- CreateTable
CREATE TABLE "case_file_hearings" (
    "caseFileNumber" TEXT NOT NULL,
    "hearingId" TEXT NOT NULL,

    CONSTRAINT "case_file_hearings_pkey" PRIMARY KEY ("caseFileNumber","hearingId")
);

-- CreateIndex
CREATE INDEX "case_file_hearings_hearingId_idx" ON "case_file_hearings"("hearingId");
CREATE UNIQUE INDEX "hearings_hearingId_lastConclusionId_key" ON "hearings"("hearingId", "lastConclusionId");

-- AddForeignKey
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "hearings"("hearingId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_file_hearings" ADD CONSTRAINT "case_file_hearings_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_file_hearings" ADD CONSTRAINT "case_file_hearings_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "hearings"("hearingId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hearings" ADD CONSTRAINT "hearings_hearingId_lastConclusionId_fkey" FOREIGN KEY ("hearingId", "lastConclusionId") REFERENCES "conclusions"("hearingId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "case_files" ADD CONSTRAINT "case_files_lastHearingId_fkey" FOREIGN KEY ("lastHearingId") REFERENCES "hearings"("hearingId") ON DELETE SET NULL ON UPDATE CASCADE;
