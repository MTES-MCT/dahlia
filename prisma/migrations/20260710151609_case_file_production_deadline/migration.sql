-- CreateEnum
CREATE TYPE "ProductionDeadlineType" AS ENUM ('MISE_EN_DEMEURE_DE_PRODUIRE', 'CLOTURE_INSTRUCTION');

-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "productionDeadlineType" "ProductionDeadlineType",
ADD COLUMN     "productionDeadlineDate" TIMESTAMP(3);
