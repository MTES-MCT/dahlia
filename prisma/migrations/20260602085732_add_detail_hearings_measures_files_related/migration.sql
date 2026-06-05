-- NOTE : Prisma génère ici un `ALTER COLUMN displayName/displayNameNormalized
-- DROP DEFAULT` parasite (drift entre le schéma Prisma qui voit ces champs
-- comme nullables sans default, et la BDD où ce sont des colonnes
-- GENERATED ALWAYS AS ... STORED, cf. migrations actor_display_name &
-- search_unaccent). Ces ALTER échouent en runtime
-- ("column is a generated column / use DROP EXPRESSION instead") et doivent
-- être supprimés à chaque régénération de cette migration.

-- AlterTable
ALTER TABLE "case_files" ADD COLUMN     "chamberId" INTEGER,
ADD COLUMN     "creationDate" TIMESTAMP(3),
ADD COLUMN     "depositDate" TIMESTAMP(3),
ADD COLUMN     "directoryComplementaryEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "directoryReference" TEXT,
ADD COLUMN     "earliestInstructionClosingDate" TIMESTAMP(3),
ADD COLUMN     "estimatedHearingDate" TIMESTAMP(3),
ADD COLUMN     "estimatedHearingPeriod" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastDecisionReading" TIMESTAMP(3),
ADD COLUMN     "recipientContactCount" INTEGER,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "hearings" ADD COLUMN     "caseFileNumber" TEXT;

-- CreateTable
CREATE TABLE "file_family_types" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "file_family_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "attached_files" (
    "encodedFileId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "subEventId" INTEGER NOT NULL DEFAULT 0,
    "receiptAcknowledgmentId" INTEGER,
    "receiptAcknowledgmentType" TEXT,
    "fileTypeLabel" TEXT NOT NULL,
    "eventCreationDate" TIMESTAMP(3) NOT NULL,
    "caseFileNumber" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "fileFamilyTypeCode" TEXT NOT NULL,

    CONSTRAINT "attached_files_pkey" PRIMARY KEY ("encodedFileId")
);

-- CreateTable
CREATE TABLE "chambers" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "chambers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measures" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL,
    "family" TEXT,

    CONSTRAINT "measures_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "case_file_events" (
    "id" INTEGER NOT NULL,
    "subEventId" INTEGER NOT NULL DEFAULT 0,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "deadlineLabel" TEXT,
    "receiptDate" TIMESTAMP(3),
    "instructionClosingDate" TIMESTAMP(3),
    "comment" TEXT,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "generateAR" BOOLEAN NOT NULL DEFAULT false,
    "nbEventFile" INTEGER NOT NULL DEFAULT 0,
    "piecesNonDownloadable" TEXT,
    "relatedEventCount" INTEGER NOT NULL DEFAULT 0,
    "caseFileNumber" TEXT NOT NULL,
    "measureCode" TEXT NOT NULL,
    "actorId" INTEGER,

    CONSTRAINT "case_file_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "related_case_files" (
    "caseFileNumber" TEXT NOT NULL,
    "relatedCaseFileNumber" TEXT NOT NULL,

    CONSTRAINT "related_case_files_pkey" PRIMARY KEY ("caseFileNumber","relatedCaseFileNumber")
);

-- CreateIndex
CREATE INDEX "attached_files_caseFileNumber_idx" ON "attached_files"("caseFileNumber");

-- CreateIndex
CREATE INDEX "attached_files_eventId_idx" ON "attached_files"("eventId");

-- CreateIndex
CREATE INDEX "case_file_events_caseFileNumber_idx" ON "case_file_events"("caseFileNumber");

-- CreateIndex
CREATE INDEX "related_case_files_relatedCaseFileNumber_idx" ON "related_case_files"("relatedCaseFileNumber");

-- CreateIndex
CREATE INDEX "hearings_caseFileNumber_idx" ON "hearings"("caseFileNumber");

-- AddForeignKey
ALTER TABLE "attached_files" ADD CONSTRAINT "attached_files_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attached_files" ADD CONSTRAINT "attached_files_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "case_file_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attached_files" ADD CONSTRAINT "attached_files_fileFamilyTypeCode_fkey" FOREIGN KEY ("fileFamilyTypeCode") REFERENCES "file_family_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "chambers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_events" ADD CONSTRAINT "case_file_events_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_events" ADD CONSTRAINT "case_file_events_measureCode_fkey" FOREIGN KEY ("measureCode") REFERENCES "measures"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_events" ADD CONSTRAINT "case_file_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "actors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_case_files" ADD CONSTRAINT "related_case_files_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_case_files" ADD CONSTRAINT "related_case_files_relatedCaseFileNumber_fkey" FOREIGN KEY ("relatedCaseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
