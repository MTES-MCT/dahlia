-- Computed column: normalized version (without accents + lowercase) of the status
-- label, used for accent-insensitive facet search (reuses f_unaccent from
-- migration search_unaccent).
ALTER TABLE "statuses" DROP COLUMN IF EXISTS "labelNormalized";

ALTER TABLE "statuses" ADD COLUMN "labelNormalized" TEXT
  GENERATED ALWAYS AS (lower(f_unaccent("label"))) STORED;
