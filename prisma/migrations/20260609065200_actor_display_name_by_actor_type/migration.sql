-- Redéfinit les colonnes calculées "displayName" et "displayNameNormalized"
-- pour les conditionner à "actorType" :
--   - NATURAL_PERSON  → "lastName [firstName]" (concaténation des champs présents)
--   - autre (LEGAL_PERSON) → COALESCE("legalPersonName", "legalEntityName")
--
-- Une colonne GENERATED ne peut pas voir son expression modifiée en place
-- (PostgreSQL n'expose pas de SET EXPRESSION pour les colonnes générées) :
-- on DROP puis on ADD. DROP COLUMN supprime automatiquement
-- "actors_displayName_idx" qui dépendait exclusivement de "displayName",
-- on le recrée à la fin (déclaré côté Prisma via @@index([displayName])).
--
-- "displayNameNormalized" est dropée et recréée car son expression contient
-- une copie de celle de "displayName" (Postgres interdit qu'une colonne
-- générée référence une autre colonne générée).

ALTER TABLE "actors" DROP COLUMN "displayNameNormalized";
ALTER TABLE "actors" DROP COLUMN "displayName";

ALTER TABLE "actors" ADD COLUMN "displayName" TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN "actorType" = 'NATURAL_PERSON'::"ActorType" THEN
        CASE
          WHEN "lastName" IS NOT NULL AND "firstName" IS NOT NULL THEN "lastName" || ' ' || "firstName"
          WHEN "lastName" IS NOT NULL THEN "lastName"
          WHEN "firstName" IS NOT NULL THEN "firstName"
        END
      ELSE COALESCE("legalPersonName", "legalEntityName")
    END
  ) STORED;

ALTER TABLE "actors" ADD COLUMN "displayNameNormalized" TEXT
  GENERATED ALWAYS AS (
    lower(f_unaccent(
      CASE
        WHEN "actorType" = 'NATURAL_PERSON'::"ActorType" THEN
          CASE
            WHEN "lastName" IS NOT NULL AND "firstName" IS NOT NULL THEN "lastName" || ' ' || "firstName"
            WHEN "lastName" IS NOT NULL THEN "lastName"
            WHEN "firstName" IS NOT NULL THEN "firstName"
          END
        ELSE COALESCE("legalPersonName", "legalEntityName")
      END
    ))
  ) STORED;

CREATE INDEX "actors_displayName_idx" ON "actors" ("displayName");
