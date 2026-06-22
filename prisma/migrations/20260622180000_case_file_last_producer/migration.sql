-- Add the lastProducer relation on case_files: the actor of the most recent
-- "reception…" event (computed during the scraper enrichment phase).

-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "lastProducerId" INTEGER;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_lastProducerId_fkey" FOREIGN KEY ("lastProducerId") REFERENCES "actors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
