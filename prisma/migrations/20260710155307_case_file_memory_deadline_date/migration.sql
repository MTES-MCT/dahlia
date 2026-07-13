-- Denormalize the last hearing convocation date on case_files for sorting.
ALTER TABLE "case_files" ADD COLUMN "lastHearingConvocationDate" TIMESTAMP(3);

UPDATE "case_files" AS cf
SET "lastHearingConvocationDate" = h."convocationDate"
FROM "hearings" AS h
WHERE cf."lastHearingId" = h."hearingId";

-- Effective memory deadline used by the dashboard sort (production date wins).
ALTER TABLE "case_files" ADD COLUMN "memoryDeadlineDate" TIMESTAMP(3)
  GENERATED ALWAYS AS (
    COALESCE("productionDeadlineDate", "lastHearingConvocationDate")
  ) STORED;

CREATE INDEX "case_files_memoryDeadlineDate_idx" ON "case_files" ("memoryDeadlineDate");
