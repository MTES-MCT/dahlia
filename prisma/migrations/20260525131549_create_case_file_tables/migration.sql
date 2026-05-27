-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('LEGAL_PERSON', 'NATURAL_PERSON');

-- CreateTable
CREATE TABLE "actors" (
    "id" INTEGER NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "lastFirstName" TEXT,
    "firstLastName" TEXT,
    "legalPersonName" TEXT,
    "legalEntityName" TEXT,
    "legalEntityId" INTEGER,
    "actorType" "ActorType" NOT NULL,
    "qualityCode" TEXT NOT NULL,

    CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualities" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "qualities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "case_files" (
    "caseFileNumber" TEXT NOT NULL,
    "assignedToLegalEntityDivisionId" INTEGER NOT NULL,
    "urgencyId" INTEGER NOT NULL,
    "lastStatusId" INTEGER NOT NULL,
    "lastStatusDate" TIMESTAMP(3) NOT NULL,
    "lastHearingId" TEXT,
    "procedureState" TEXT,
    "mainClaimantId" INTEGER NOT NULL,
    "mainDefenderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_files_pkey" PRIMARY KEY ("caseFileNumber")
);

-- CreateTable
CREATE TABLE "conclusions" (
    "id" INTEGER NOT NULL,
    "conclusionSense" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3) NOT NULL,
    "author" TEXT,
    "conclusionOperativePartId" INTEGER NOT NULL,

    CONSTRAINT "conclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conclusion_operative_parts" (
    "id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "conclusion_operative_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hearings" (
    "hearingId" TEXT NOT NULL,
    "convocationDate" TIMESTAMP(3) NOT NULL,
    "room" TEXT NOT NULL,
    "creationDate" TIMESTAMP(3),
    "modificationDates" TIMESTAMP(3)[],
    "lastConclusionId" INTEGER,

    CONSTRAINT "hearings_pkey" PRIMARY KEY ("hearingId")
);

-- CreateTable
CREATE TABLE "legal_entity_divisions" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,

    CONSTRAINT "legal_entity_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
    "id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "urgencies" (
    "id" INTEGER NOT NULL,
    "key" TEXT,
    "description" TEXT NOT NULL,
    "colorHexadecimalCode" TEXT NOT NULL,

    CONSTRAINT "urgencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qualities_name_key" ON "qualities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "case_files_lastHearingId_key" ON "case_files"("lastHearingId");

-- CreateIndex
CREATE UNIQUE INDEX "conclusion_operative_parts_label_key" ON "conclusion_operative_parts"("label");

-- CreateIndex
CREATE UNIQUE INDEX "hearings_lastConclusionId_key" ON "hearings"("lastConclusionId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entity_divisions_shortName_key" ON "legal_entity_divisions"("shortName");

-- AddForeignKey
ALTER TABLE "actors" ADD CONSTRAINT "actors_qualityCode_fkey" FOREIGN KEY ("qualityCode") REFERENCES "qualities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_assignedToLegalEntityDivisionId_fkey" FOREIGN KEY ("assignedToLegalEntityDivisionId") REFERENCES "legal_entity_divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_urgencyId_fkey" FOREIGN KEY ("urgencyId") REFERENCES "urgencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_lastStatusId_fkey" FOREIGN KEY ("lastStatusId") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_lastHearingId_fkey" FOREIGN KEY ("lastHearingId") REFERENCES "hearings"("hearingId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_mainClaimantId_fkey" FOREIGN KEY ("mainClaimantId") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_mainDefenderId_fkey" FOREIGN KEY ("mainDefenderId") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_conclusionOperativePartId_fkey" FOREIGN KEY ("conclusionOperativePartId") REFERENCES "conclusion_operative_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_lastConclusionId_fkey" FOREIGN KEY ("lastConclusionId") REFERENCES "conclusions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
