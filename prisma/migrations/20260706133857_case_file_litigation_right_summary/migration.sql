-- CreateEnum
CREATE TYPE "LitigationType" AS ENUM ('INDEMNITAIRE', 'REFERE', 'INJONCTION', 'EXCES_DE_POUVOIR');

-- CreateEnum
CREATE TYPE "RightType" AS ENUM ('LOGEMENT', 'HEBERGEMENT');

-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "litigationType" "LitigationType",
ADD COLUMN     "rightType" "RightType",
ADD COLUMN     "summary" TEXT;
