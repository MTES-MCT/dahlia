-- Telerecours ids (case-file numbers, actors, events, attached files, hearings,
-- conclusions, chambers) are only unique within a court. Every court-scoped
-- table gets a "jurisdictionCode" column (court code, e.g. "TA069" for both the
-- TA069 and TA069bis instances) that becomes part of its primary key and of
-- every composite foreign key. Existing ids are kept as-is.
--
-- Backfill: the court comes from case_files.jurisdictionId. A shared row
-- (actor, hearing, conclusion, chamber) referenced from several courts is an
-- id collision that was merged on upsert: it is duplicated once per court (a
-- full rescrape then fixes the content). Rows referenced by nobody are dropped.
--
-- Hand-written (Prisma would drop the data). Prisma's spurious
-- "ALTER COLUMN … DROP DEFAULT" on generated columns and the drop of
-- case_files_memoryDeadlineDate_idx were removed on purpose.

BEGIN;

-- ─── 1. Drop foreign keys and indexes that reference the old keys ───

ALTER TABLE "actor_representations" DROP CONSTRAINT "actor_representations_caseFileNumber_fkey";
ALTER TABLE "actor_representations" DROP CONSTRAINT "actor_representations_representativeActorId_fkey";
ALTER TABLE "actor_representations" DROP CONSTRAINT "actor_representations_representedActorId_fkey";
ALTER TABLE "attached_files" DROP CONSTRAINT "attached_files_caseFileNumber_fkey";
ALTER TABLE "attached_files" DROP CONSTRAINT "attached_files_eventId_fkey";
ALTER TABLE "case_file_actors" DROP CONSTRAINT "case_file_actors_actorId_fkey";
ALTER TABLE "case_file_actors" DROP CONSTRAINT "case_file_actors_caseFileNumber_fkey";
ALTER TABLE "case_file_events" DROP CONSTRAINT "case_file_events_actorId_fkey";
ALTER TABLE "case_file_events" DROP CONSTRAINT "case_file_events_caseFileNumber_fkey";
ALTER TABLE "case_file_hearings" DROP CONSTRAINT "case_file_hearings_caseFileNumber_fkey";
ALTER TABLE "case_file_hearings" DROP CONSTRAINT "case_file_hearings_hearingId_fkey";
ALTER TABLE "case_file_tags" DROP CONSTRAINT "case_file_tags_caseFileNumber_fkey";
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_chamberId_fkey";
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_lastHearingId_fkey";
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_lastProducerId_fkey";
ALTER TABLE "classification_field_changes" DROP CONSTRAINT "classification_field_changes_caseFileNumber_fkey";
ALTER TABLE "conclusions" DROP CONSTRAINT "conclusions_hearingId_fkey";
ALTER TABLE "hearings" DROP CONSTRAINT "hearings_hearingId_lastConclusionId_fkey";
ALTER TABLE "last_decision_readings" DROP CONSTRAINT "last_decision_readings_caseFileNumber_fkey";
ALTER TABLE "related_case_files" DROP CONSTRAINT "related_case_files_caseFileNumber_fkey";
ALTER TABLE "related_case_files" DROP CONSTRAINT "related_case_files_relatedCaseFileNumber_fkey";

DROP INDEX "attached_files_caseFileNumber_idx";
DROP INDEX "attached_files_eventId_idx";
DROP INDEX "case_file_actors_actorId_idx";
DROP INDEX "case_file_events_caseFileNumber_idx";
DROP INDEX "case_file_hearings_hearingId_idx";
DROP INDEX "classification_field_changes_caseFileNumber_changedAt_idx";
DROP INDEX "hearings_hearingId_lastConclusionId_key";
DROP INDEX "related_case_files_relatedCaseFileNumber_idx";

ALTER TABLE "actor_representations" DROP CONSTRAINT "actor_representations_pkey";
ALTER TABLE "actors" DROP CONSTRAINT "actors_pkey";
ALTER TABLE "attached_files" DROP CONSTRAINT "attached_files_pkey";
ALTER TABLE "case_file_actors" DROP CONSTRAINT "case_file_actors_pkey";
ALTER TABLE "case_file_events" DROP CONSTRAINT "case_file_events_pkey";
ALTER TABLE "case_file_hearings" DROP CONSTRAINT "case_file_hearings_pkey";
ALTER TABLE "case_file_tags" DROP CONSTRAINT "case_file_tags_pkey";
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_pkey";
ALTER TABLE "chambers" DROP CONSTRAINT "chambers_pkey";
ALTER TABLE "conclusions" DROP CONSTRAINT "conclusions_pkey";
ALTER TABLE "hearings" DROP CONSTRAINT "hearings_pkey";
ALTER TABLE "last_decision_readings" DROP CONSTRAINT "last_decision_readings_pkey";
ALTER TABLE "related_case_files" DROP CONSTRAINT "related_case_files_pkey";

-- ─── 2. Jurisdictions: court code of each Dahlia instance ───
-- Mirrors <shortName>_TELERECOURS_JURISDICTION (TA069bis → TA069). Check the
-- result against the production environment before deploying.

ALTER TABLE "jurisdictions" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "jurisdictions" SET "jurisdictionCode" = regexp_replace("shortName", 'bis$', '');
ALTER TABLE "jurisdictions" ALTER COLUMN "jurisdictionCode" SET NOT NULL;

-- ─── 3. Case files ───

ALTER TABLE "case_files" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "case_files" c SET "jurisdictionCode" = j."jurisdictionCode"
FROM "jurisdictions" j WHERE j."id" = c."jurisdictionId";

DO $$
DECLARE missing INTEGER;
BEGIN
  SELECT count(*) INTO missing FROM "case_files" WHERE "jurisdictionCode" IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION '% case file(s) without jurisdiction: tag them (rescrape) before migrating', missing;
  END IF;
END $$;

ALTER TABLE "case_files" ALTER COLUMN "jurisdictionCode" SET NOT NULL;

-- ─── 4. Rows owned by a case file: copy its court ───
-- caseFileNumber is still unique at this point, so the join is unambiguous.

ALTER TABLE "case_file_actors" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "case_file_actors" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "actor_representations" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "actor_representations" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "case_file_events" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "case_file_events" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "attached_files" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "attached_files" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "case_file_hearings" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "case_file_hearings" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "case_file_tags" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "case_file_tags" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "classification_field_changes" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "classification_field_changes" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "last_decision_readings" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "last_decision_readings" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

ALTER TABLE "related_case_files" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "related_case_files" t SET "jurisdictionCode" = c."jurisdictionCode"
FROM "case_files" c WHERE c."caseFileNumber" = t."caseFileNumber";

-- A link between two case files of different courts can only come from a
-- merged collision: drop it (phase C of the scrape recreates valid links).
DELETE FROM "related_case_files" r
USING "case_files" target
WHERE target."caseFileNumber" = r."relatedCaseFileNumber"
  AND target."jurisdictionCode" <> r."jurisdictionCode";

-- Attached files whose event was merged into a case file of another court
-- (event id collision): give the event back a copy in the attached file's
-- court, on the attached file's case file, so the user metadata on the
-- attached file is kept. Done before the actor backfill below, which also
-- reads case_file_events.actorId.
INSERT INTO "case_file_events" ("jurisdictionCode", "id", "subEventId", "eventDate",
  "deadlineLabel", "receiptDate", "instructionClosingDate", "comment", "hasAttachment",
  "generateAR", "nbEventFile", "piecesNonDownloadable", "relatedEventCount",
  "caseFileNumber", "measureCode", "actorId")
SELECT DISTINCT ON (af."jurisdictionCode", e."id")
  af."jurisdictionCode", e."id", e."subEventId", e."eventDate",
  e."deadlineLabel", e."receiptDate", e."instructionClosingDate", e."comment", e."hasAttachment",
  e."generateAR", e."nbEventFile", e."piecesNonDownloadable", e."relatedEventCount",
  af."caseFileNumber", e."measureCode", e."actorId"
FROM "attached_files" af
JOIN "case_file_events" e ON e."id" = af."eventId" AND e."jurisdictionCode" <> af."jurisdictionCode"
ORDER BY af."jurisdictionCode", e."id", af."caseFileNumber";

-- ─── 5. Shared rows: court deduced from their references ───

-- Actors: referenced by case_file_actors, actor_representations (both sides),
-- case_file_events.actorId and case_files.lastProducerId.
CREATE TEMP TABLE "actor_courts" AS
SELECT DISTINCT "actorId" AS "id", "jurisdictionCode" FROM (
  SELECT "actorId", "jurisdictionCode" FROM "case_file_actors"
  UNION ALL SELECT "representedActorId", "jurisdictionCode" FROM "actor_representations"
  UNION ALL SELECT "representativeActorId", "jurisdictionCode" FROM "actor_representations"
  UNION ALL SELECT "actorId", "jurisdictionCode" FROM "case_file_events" WHERE "actorId" IS NOT NULL
  UNION ALL SELECT "lastProducerId", "jurisdictionCode" FROM "case_files" WHERE "lastProducerId" IS NOT NULL
) refs;

ALTER TABLE "actors" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "actors" a SET "jurisdictionCode" = (
  SELECT min(ac."jurisdictionCode") FROM "actor_courts" ac WHERE ac."id" = a."id"
);
INSERT INTO "actors" ("jurisdictionCode", "id", "firstName", "lastName", "lastFirstName",
  "firstLastName", "legalPersonName", "legalEntityName", "legalEntityId", "actorType")
SELECT ac."jurisdictionCode", a."id", a."firstName", a."lastName", a."lastFirstName",
  a."firstLastName", a."legalPersonName", a."legalEntityName", a."legalEntityId", a."actorType"
FROM "actors" a
JOIN "actor_courts" ac ON ac."id" = a."id" AND ac."jurisdictionCode" <> a."jurisdictionCode";
DELETE FROM "actors" WHERE "jurisdictionCode" IS NULL;

-- Chambers: referenced by case_files.chamberId.
CREATE TEMP TABLE "chamber_courts" AS
SELECT DISTINCT "chamberId" AS "id", "jurisdictionCode" FROM "case_files" WHERE "chamberId" IS NOT NULL;

ALTER TABLE "chambers" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "chambers" ch SET "jurisdictionCode" = (
  SELECT min(cc."jurisdictionCode") FROM "chamber_courts" cc WHERE cc."id" = ch."id"
);
INSERT INTO "chambers" ("jurisdictionCode", "id", "name")
SELECT cc."jurisdictionCode", ch."id", ch."name"
FROM "chambers" ch
JOIN "chamber_courts" cc ON cc."id" = ch."id" AND cc."jurisdictionCode" <> ch."jurisdictionCode";
DELETE FROM "chambers" WHERE "jurisdictionCode" IS NULL;

-- Hearings: referenced by case_file_hearings and case_files.lastHearingId.
CREATE TEMP TABLE "hearing_courts" AS
SELECT DISTINCT "hearingId", "jurisdictionCode" FROM (
  SELECT "hearingId", "jurisdictionCode" FROM "case_file_hearings"
  UNION ALL SELECT "lastHearingId", "jurisdictionCode" FROM "case_files" WHERE "lastHearingId" IS NOT NULL
) refs;

ALTER TABLE "hearings" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "hearings" h SET "jurisdictionCode" = (
  SELECT min(hc."jurisdictionCode") FROM "hearing_courts" hc WHERE hc."hearingId" = h."hearingId"
);
INSERT INTO "hearings" ("jurisdictionCode", "hearingId", "convocationDate", "room",
  "creationDate", "modificationDates", "lastConclusionId")
SELECT hc."jurisdictionCode", h."hearingId", h."convocationDate", h."room",
  h."creationDate", h."modificationDates", h."lastConclusionId"
FROM "hearings" h
JOIN "hearing_courts" hc ON hc."hearingId" = h."hearingId" AND hc."jurisdictionCode" <> h."jurisdictionCode";
DELETE FROM "hearings" WHERE "jurisdictionCode" IS NULL;

-- Conclusions follow their hearing: one copy per court the hearing now has.
ALTER TABLE "conclusions" ADD COLUMN "jurisdictionCode" TEXT;
UPDATE "conclusions" co SET "jurisdictionCode" = (
  SELECT min(h."jurisdictionCode") FROM "hearings" h WHERE h."hearingId" = co."hearingId"
);
INSERT INTO "conclusions" ("jurisdictionCode", "id", "hearingId", "conclusionSense",
  "publicationDate", "author", "conclusionOperativePartId")
SELECT h."jurisdictionCode", co."id", co."hearingId", co."conclusionSense",
  co."publicationDate", co."author", co."conclusionOperativePartId"
FROM "conclusions" co
JOIN "hearings" h ON h."hearingId" = co."hearingId" AND h."jurisdictionCode" <> co."jurisdictionCode";
DELETE FROM "conclusions" WHERE "jurisdictionCode" IS NULL;

-- ─── 6. NOT NULL, primary keys, indexes ───

ALTER TABLE "actor_representations" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "actors" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "attached_files" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "case_file_actors" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "case_file_events" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "case_file_hearings" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "case_file_tags" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "chambers" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "classification_field_changes" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "conclusions" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "hearings" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "last_decision_readings" ALTER COLUMN "jurisdictionCode" SET NOT NULL;
ALTER TABLE "related_case_files" ALTER COLUMN "jurisdictionCode" SET NOT NULL;

ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber", "representedActorId", "representativeActorId");
ALTER TABLE "actors" ADD CONSTRAINT "actors_pkey" PRIMARY KEY ("jurisdictionCode", "id");
ALTER TABLE "attached_files" ADD CONSTRAINT "attached_files_pkey" PRIMARY KEY ("jurisdictionCode", "encodedFileId");
ALTER TABLE "case_file_actors" ADD CONSTRAINT "case_file_actors_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber", "actorId");
ALTER TABLE "case_file_events" ADD CONSTRAINT "case_file_events_pkey" PRIMARY KEY ("jurisdictionCode", "id");
ALTER TABLE "case_file_hearings" ADD CONSTRAINT "case_file_hearings_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber", "hearingId");
ALTER TABLE "case_file_tags" ADD CONSTRAINT "case_file_tags_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber", "tagId");
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber");
ALTER TABLE "chambers" ADD CONSTRAINT "chambers_pkey" PRIMARY KEY ("jurisdictionCode", "id");
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_pkey" PRIMARY KEY ("jurisdictionCode", "hearingId", "id");
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_pkey" PRIMARY KEY ("jurisdictionCode", "hearingId");
ALTER TABLE "last_decision_readings" ADD CONSTRAINT "last_decision_readings_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber");
ALTER TABLE "related_case_files" ADD CONSTRAINT "related_case_files_pkey" PRIMARY KEY ("jurisdictionCode", "caseFileNumber", "relatedCaseFileNumber");

CREATE INDEX "attached_files_jurisdictionCode_caseFileNumber_idx" ON "attached_files"("jurisdictionCode", "caseFileNumber");
CREATE INDEX "attached_files_jurisdictionCode_eventId_idx" ON "attached_files"("jurisdictionCode", "eventId");
CREATE INDEX "case_file_actors_jurisdictionCode_actorId_idx" ON "case_file_actors"("jurisdictionCode", "actorId");
CREATE INDEX "case_file_events_jurisdictionCode_caseFileNumber_idx" ON "case_file_events"("jurisdictionCode", "caseFileNumber");
CREATE INDEX "case_file_hearings_jurisdictionCode_hearingId_idx" ON "case_file_hearings"("jurisdictionCode", "hearingId");
CREATE INDEX "case_files_caseFileNumber_idx" ON "case_files"("caseFileNumber");
CREATE INDEX "classification_field_changes_jurisdictionCode_caseFileNumbe_idx" ON "classification_field_changes"("jurisdictionCode", "caseFileNumber", "changedAt");
CREATE UNIQUE INDEX "hearings_jurisdictionCode_hearingId_lastConclusionId_key" ON "hearings"("jurisdictionCode", "hearingId", "lastConclusionId");
CREATE INDEX "related_case_files_jurisdictionCode_relatedCaseFileNumber_idx" ON "related_case_files"("jurisdictionCode", "relatedCaseFileNumber");

-- ─── 7. Composite foreign keys (they also validate the backfill) ───

ALTER TABLE "attached_files" ADD CONSTRAINT "attached_files_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attached_files" ADD CONSTRAINT "attached_files_jurisdictionCode_eventId_fkey" FOREIGN KEY ("jurisdictionCode", "eventId") REFERENCES "case_file_events"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_jurisdictionCode_lastHearingId_fkey" FOREIGN KEY ("jurisdictionCode", "lastHearingId") REFERENCES "hearings"("jurisdictionCode", "hearingId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_jurisdictionCode_chamberId_fkey" FOREIGN KEY ("jurisdictionCode", "chamberId") REFERENCES "chambers"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_jurisdictionCode_lastProducerId_fkey" FOREIGN KEY ("jurisdictionCode", "lastProducerId") REFERENCES "actors"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_file_actors" ADD CONSTRAINT "case_file_actors_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_file_actors" ADD CONSTRAINT "case_file_actors_jurisdictionCode_actorId_fkey" FOREIGN KEY ("jurisdictionCode", "actorId") REFERENCES "actors"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_jurisdictionCode_representedActorId_fkey" FOREIGN KEY ("jurisdictionCode", "representedActorId") REFERENCES "actors"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actor_representations" ADD CONSTRAINT "actor_representations_jurisdictionCode_representativeActor_fkey" FOREIGN KEY ("jurisdictionCode", "representativeActorId") REFERENCES "actors"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classification_field_changes" ADD CONSTRAINT "classification_field_changes_jurisdictionCode_caseFileNumb_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_jurisdictionCode_hearingId_fkey" FOREIGN KEY ("jurisdictionCode", "hearingId") REFERENCES "hearings"("jurisdictionCode", "hearingId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_file_hearings" ADD CONSTRAINT "case_file_hearings_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_file_hearings" ADD CONSTRAINT "case_file_hearings_jurisdictionCode_hearingId_fkey" FOREIGN KEY ("jurisdictionCode", "hearingId") REFERENCES "hearings"("jurisdictionCode", "hearingId") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL limited to "lastConclusionId": nulling the whole composite would
-- break the hearing's primary key (Postgres 15+).
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_jurisdictionCode_hearingId_lastConclusionId_fkey" FOREIGN KEY ("jurisdictionCode", "hearingId", "lastConclusionId") REFERENCES "conclusions"("jurisdictionCode", "hearingId", "id") ON DELETE SET NULL ("lastConclusionId") ON UPDATE CASCADE;
ALTER TABLE "last_decision_readings" ADD CONSTRAINT "last_decision_readings_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_file_events" ADD CONSTRAINT "case_file_events_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_file_events" ADD CONSTRAINT "case_file_events_jurisdictionCode_actorId_fkey" FOREIGN KEY ("jurisdictionCode", "actorId") REFERENCES "actors"("jurisdictionCode", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "related_case_files" ADD CONSTRAINT "related_case_files_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "related_case_files" ADD CONSTRAINT "related_case_files_jurisdictionCode_relatedCaseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "relatedCaseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_file_tags" ADD CONSTRAINT "case_file_tags_jurisdictionCode_caseFileNumber_fkey" FOREIGN KEY ("jurisdictionCode", "caseFileNumber") REFERENCES "case_files"("jurisdictionCode", "caseFileNumber") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "actor_courts";
DROP TABLE "chamber_courts";
DROP TABLE "hearing_courts";

COMMIT;
