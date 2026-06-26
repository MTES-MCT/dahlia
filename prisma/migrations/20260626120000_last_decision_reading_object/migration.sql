-- CreateTable
CREATE TABLE "last_decision_readings" (
    "caseFileNumber" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "notificationDate" TIMESTAMP(3),
    "nature" TEXT,
    "operativePart" TEXT,

    CONSTRAINT "last_decision_readings_pkey" PRIMARY KEY ("caseFileNumber")
);

-- AddForeignKey
ALTER TABLE "last_decision_readings" ADD CONSTRAINT "last_decision_readings_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "case_files" DROP COLUMN "lastDecisionReading";
