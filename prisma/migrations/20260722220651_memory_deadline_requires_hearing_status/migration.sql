-- The hearing convocation date must only count as the effective memory
-- deadline when the case file status is "Inscrit au rôle d'une audience".
-- That check requires a lookup on "statuses", which a Postgres generated
-- column cannot do: replace the generated "memoryDeadlineDate" column with a
-- plain column maintained by a trigger.

-- Dropping the column also drops its index; both are recreated below.
ALTER TABLE "case_files" DROP COLUMN "memoryDeadlineDate";
ALTER TABLE "case_files" ADD COLUMN "memoryDeadlineDate" TIMESTAMP(3);

-- Effective memory deadline: the production deadline wins; otherwise the last
-- hearing convocation date, but only while the case file is scheduled for a
-- hearing. Uses the same normalization pipeline as statuses."labelNormalized"
-- (lower + f_unaccent, cf. migration status_label_normalized).
CREATE OR REPLACE FUNCTION case_files_compute_memory_deadline()
RETURNS trigger AS $$
BEGIN
  NEW."memoryDeadlineDate" := COALESCE(
    NEW."productionDeadlineDate",
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM "statuses" s
        WHERE s."id" = NEW."lastStatusId"
          AND s."labelNormalized" = lower(f_unaccent('Inscrit au rôle d''une audience'))
      )
      THEN NEW."lastHearingConvocationDate"
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_files_memory_deadline_trigger
  BEFORE INSERT OR UPDATE ON "case_files"
  FOR EACH ROW
  EXECUTE FUNCTION case_files_compute_memory_deadline();

-- Keep case_files in sync if a status label ever changes: the no-op update
-- re-fires the BEFORE UPDATE trigger above on every affected case file.
CREATE OR REPLACE FUNCTION statuses_refresh_memory_deadline()
RETURNS trigger AS $$
BEGIN
  UPDATE "case_files"
  SET "lastStatusId" = "lastStatusId"
  WHERE "lastStatusId" = NEW."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statuses_memory_deadline_trigger
  AFTER UPDATE OF "label" ON "statuses"
  FOR EACH ROW
  WHEN (NEW."label" IS DISTINCT FROM OLD."label")
  EXECUTE FUNCTION statuses_refresh_memory_deadline();

-- Backfill: the no-op update fires the trigger on every existing row.
UPDATE "case_files" SET "lastStatusId" = "lastStatusId";

CREATE INDEX "case_files_memoryDeadlineDate_idx" ON "case_files" ("memoryDeadlineDate");
