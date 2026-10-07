-- At most one main claimant / main defender per case file. These partial unique
-- indexes (not modelled in the Prisma schema) were created on "caseFileNumber"
-- alone by migration case_file_actors and were missed by
-- jurisdiction_code_composite_keys: a case-file number being unique per court
-- only, two case files of different courts sharing a number collided on them.
-- Hand-written: Prisma does not see these indexes.

DROP INDEX "case_file_actors_one_main_claimant_idx";
DROP INDEX "case_file_actors_one_main_defender_idx";

CREATE UNIQUE INDEX "case_file_actors_one_main_claimant_idx"
  ON "case_file_actors" ("jurisdictionCode", "caseFileNumber")
  WHERE "isMainClaimant" = true;

CREATE UNIQUE INDEX "case_file_actors_one_main_defender_idx"
  ON "case_file_actors" ("jurisdictionCode", "caseFileNumber")
  WHERE "isMainDefender" = true;
