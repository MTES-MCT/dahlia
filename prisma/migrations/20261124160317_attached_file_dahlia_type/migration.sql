-- CreateEnum
CREATE TYPE "AttachedFileDahliaType" AS ENUM ('REQUETE', 'DECISION_COMED');

-- AlterTable
ALTER TABLE "attached_files" ADD COLUMN "dahliaType" "AttachedFileDahliaType";
