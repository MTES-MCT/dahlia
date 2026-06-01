-- Active l'extension unaccent (supprime les diacritiques : é → e, ç → c…).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent(text) is STABLE (its result depends on the search_path which resolves the dictionary). The GENERATED columns require an IMMUTABLE expression:
-- the GENERATED columns require an IMMUTABLE expression:
-- we wrap the call by explicitly targeting public.unaccent.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql
  IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

-- Computed column : normalized version (without accents + lowercase) of the displayed name, used for the text search insensitive to accents.
-- The displayName expression is duplicated here because Postgres prohibits a GENERATED column from depending on another GENERATED column.
ALTER TABLE "actors" ADD COLUMN "displayNameNormalized" TEXT
  GENERATED ALWAYS AS (
    lower(f_unaccent(
      COALESCE(
        "legalPersonName",
        "legalEntityName",
        CASE
          WHEN "lastName" IS NOT NULL AND "firstName" IS NOT NULL THEN "lastName" || ' ' || "firstName"
          WHEN "lastName" IS NOT NULL THEN "lastName"
          WHEN "firstName" IS NOT NULL THEN "firstName"
        END
      )
    ))
  ) STORED;
