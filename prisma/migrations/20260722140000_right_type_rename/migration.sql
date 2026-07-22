-- Migration to rename RightType enum values: LOGEMENT -> DALO, HEBERGEMENT -> DAHO
--
-- For PostgreSQL, we use the ALTER TYPE RENAME VALUE command which is supported in PG 9.1+
-- This directly renames the enum values without needing to recreate the enum

-- Rename the enum values (this doesn't automatically update existing data)
ALTER TYPE "RightType" RENAME VALUE 'LOGEMENT' TO 'DALO';
ALTER TYPE "RightType" RENAME VALUE 'HEBERGEMENT' TO 'DAHO';
