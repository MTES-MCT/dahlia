-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "telerecoursContentHash" TEXT,
ADD COLUMN     "telerecoursSyncAt" TIMESTAMP(3),
ADD COLUMN     "telerecoursUpdatedAt" TIMESTAMP(3);
