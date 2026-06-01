-- Rendre mainDefenderId optionnel sur case_files (certains dossiers Télérecours
-- arrivent sans défendeur principal renseigné).
--
-- NOTE : Prisma ajoute systématiquement à cette migration des `ALTER TABLE actors
-- ALTER COLUMN displayName/displayNameNormalized DROP DEFAULT` à cause d'un drift
-- entre le schéma Prisma (qui voit ces champs comme de simples colonnes nullables)
-- et la BDD (où ce sont des colonnes GENERATED ALWAYS AS ... STORED, cf.
-- migrations actor_display_name & search_unaccent). Ces ALTER échouent en runtime
-- ("column is a generated column / use DROP EXPRESSION instead") et doivent être
-- supprimés à chaque régénération.

-- DropForeignKey
ALTER TABLE "case_files" DROP CONSTRAINT "case_files_mainDefenderId_fkey";

-- AlterTable
ALTER TABLE "case_files" ALTER COLUMN "mainDefenderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_mainDefenderId_fkey" FOREIGN KEY ("mainDefenderId") REFERENCES "actors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
