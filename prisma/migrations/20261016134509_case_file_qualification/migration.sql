-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "comDaloNumber" TEXT,
ADD COLUMN     "comedDecisionDate" DATE,
ADD COLUMN     "qualificationValidatedAt" TIMESTAMP(3);
