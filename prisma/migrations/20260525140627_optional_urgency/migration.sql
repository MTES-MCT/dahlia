-- DropForeignKey
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_urgencyId_fkey";

-- AlterTable
ALTER TABLE "case_files" ALTER COLUMN "urgencyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_urgencyId_fkey" FOREIGN KEY ("urgencyId") REFERENCES "urgencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
