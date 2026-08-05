-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "shortName" TEXT NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_shortName_key" ON "jurisdictions"("shortName");

-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "jurisdictionId" INTEGER;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
