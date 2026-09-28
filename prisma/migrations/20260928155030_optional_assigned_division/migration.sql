-- Make assignedToLegalEntityDivisionId optional: some Telerecours payloads
-- omit the assigned division, and those case files are stored with a null FK.
--
-- NOTE: Prisma also injects ALTER … DROP DEFAULT on generated columns
-- (actors.displayName, search-normalized columns) and a DROP INDEX on
-- case_files_memoryDeadlineDate_idx. Those statements fail or undo real
-- indexes and must be removed before applying.

-- DropForeignKey
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_assignedToLegalEntityDivisionId_fkey";

-- AlterTable
ALTER TABLE "case_files" ALTER COLUMN "assignedToLegalEntityDivisionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_assignedToLegalEntityDivisionId_fkey" FOREIGN KEY ("assignedToLegalEntityDivisionId") REFERENCES "legal_entity_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
