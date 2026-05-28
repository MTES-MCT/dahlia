-- AlterTable
-- Colonne calculée reproduisant getActorDisplayName (priorité :
-- legalPersonName > legalEntityName > "lastName firstName" > lastName > firstName).
-- L'expression doit être IMMUTABLE (contrainte des colonnes générées) : on
-- utilise CASE + || plutôt que concat_ws (STABLE). Le cas "tout NULL" donne NULL
-- (trié en dernier). STORED : recalculée à chaque écriture, lecture seule côté app.
ALTER TABLE "actors" ADD COLUMN "displayName" TEXT
  GENERATED ALWAYS AS (
    COALESCE(
      "legalPersonName",
      "legalEntityName",
      CASE
        WHEN "lastName" IS NOT NULL AND "firstName" IS NOT NULL THEN "lastName" || ' ' || "firstName"
        WHEN "lastName" IS NOT NULL THEN "lastName"
        WHEN "firstName" IS NOT NULL THEN "firstName"
      END
    )
  ) STORED;

-- Index pour le tri alphabétique sur le nom affiché.
CREATE INDEX "actors_displayName_idx" ON "actors" ("displayName");
