/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `lastLoginAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `users` table. All the data in the column will be lost.
  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- NOTE : Prisma génère systématiquement ici un `ALTER TABLE actors ALTER COLUMN
-- displayName/displayNameNormalized DROP DEFAULT` parasite (drift entre le schéma
-- Prisma, qui voit ces champs comme de simples colonnes nullables, et la BDD où
-- ce sont des colonnes GENERATED ALWAYS AS ... STORED, cf. migrations
-- actor_display_name & search_unaccent). Ces ALTER échouent en runtime
-- ("column is a generated column / use DROP EXPRESSION instead") et ont été
-- supprimés ici. À refaire à chaque régénération de cette migration.

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "lastLoginAt",
DROP COLUMN "passwordHash",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "validated" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "users_id_seq";

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
