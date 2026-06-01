-- DropForeignKey
ALTER TABLE "conclusions" DROP CONSTRAINT IF EXISTS "conclusions_conclusionOperativePartId_fkey";

-- AlterTable
ALTER TABLE "conclusions" ALTER COLUMN "conclusionOperativePartId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_conclusionOperativePartId_fkey" FOREIGN KEY ("conclusionOperativePartId") REFERENCES "conclusion_operative_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
