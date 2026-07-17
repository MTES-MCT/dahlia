-- CreateTable
CREATE TABLE "case_file_actors" (
    "caseFileNumber" TEXT NOT NULL,
    "actorId" INTEGER NOT NULL,
    "qualityCode" TEXT NOT NULL,
    "isMainClaimant" BOOLEAN NOT NULL DEFAULT false,
    "isMainDefender" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "case_file_actors_pkey" PRIMARY KEY ("caseFileNumber","actorId")
);

-- CreateTable
CREATE TABLE "actor_representations" (
    "caseFileNumber" TEXT NOT NULL,
    "representedActorId" INTEGER NOT NULL,
    "representativeActorId" INTEGER NOT NULL,

    CONSTRAINT "actor_representations_pkey" PRIMARY KEY ("caseFileNumber","representedActorId","representativeActorId")
);

-- Migrate existing main claimant / defender links into case_file_actors.
INSERT INTO "case_file_actors" ("caseFileNumber", "actorId", "qualityCode", "isMainClaimant", "isMainDefender")
SELECT cf."caseFileNumber", cf."mainClaimantId", a."qualityCode", true, false
FROM "case_files" cf
JOIN "actors" a ON a."id" = cf."mainClaimantId";

INSERT INTO "case_file_actors" ("caseFileNumber", "actorId", "qualityCode", "isMainClaimant", "isMainDefender")
SELECT cf."caseFileNumber", cf."mainDefenderId", a."qualityCode", false, true
FROM "case_files" cf
JOIN "actors" a ON a."id" = cf."mainDefenderId"
WHERE cf."mainDefenderId" IS NOT NULL
ON CONFLICT ("caseFileNumber", "actorId") DO UPDATE
SET "qualityCode" = EXCLUDED."qualityCode",
    "isMainDefender" = true;

-- DropForeignKey
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_mainClaimantId_fkey";

-- DropForeignKey
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_mainDefenderId_fkey";

-- DropForeignKey
ALTER TABLE "actors" DROP CONSTRAINT "actors_qualityCode_fkey";

-- AlterTable
ALTER TABLE "case_files" DROP COLUMN "mainClaimantId",
DROP COLUMN "mainDefenderId";

-- AlterTable
ALTER TABLE "actors" DROP COLUMN "qualityCode";

-- CreateIndex
CREATE INDEX "case_file_actors_actorId_idx" ON "case_file_actors"("actorId");

-- At most one main claimant / defender per case file.
CREATE UNIQUE INDEX "case_file_actors_one_main_claimant_idx"
  ON "case_file_actors" ("caseFileNumber")
  WHERE "isMainClaimant" = true;

CREATE UNIQUE INDEX "case_file_actors_one_main_defender_idx"
  ON "case_file_actors" ("caseFileNumber")
  WHERE "isMainDefender" = true;

-- AddForeignKey
ALTER TABLE "case_file_actors" ADD CONSTRAINT "case_file_actors_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_actors" ADD CONSTRAINT "case_file_actors_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_actors" ADD CONSTRAINT "case_file_actors_qualityCode_fkey" FOREIGN KEY ("qualityCode") REFERENCES "qualities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_caseFileNumber_fkey" FOREIGN KEY ("caseFileNumber") REFERENCES "case_files"("caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_representedActorId_fkey" FOREIGN KEY ("representedActorId") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_representativeActorId_fkey" FOREIGN KEY ("representativeActorId") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
