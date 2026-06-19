// Seeds the test database with deterministic business data for the Playwright
// end-to-end suite. Run against a freshly migrated `dahlia_test` database:
//
//   pnpm db:migrate:deploy   # apply migrations (DATABASE_URL -> test db)
//   pnpm test:e2e:seed       # this script
//
// It only manages business tables (divisions, qualities, statuses, actors,
// case files). The auth tables (users/sessions/accounts) are left untouched:
// the test agent's `users` row is created by the app on the first ProConnect
// login (see app/lib/auth.ts).

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Status filtered by default on the case-files list page (app/(protected)/case_files/page.tsx).
// At least one case file must carry it to be visible on first load.
const DEFAULT_STATUS_LABEL = "Inscrit au rôle d'une audience";

async function main() {
  // Wipe business data in dependency order so the seed is idempotent. `users`,
  // `sessions` and `accounts` are intentionally not touched.
  await prisma.hearing.deleteMany();
  await prisma.caseFile.deleteMany();
  await prisma.actor.deleteMany();
  await prisma.status.deleteMany();
  await prisma.quality.deleteMany();
  await prisma.legalEntityDivision.deleteMany();

  await prisma.legalEntityDivision.create({
    data: { id: 1, name: "DDETS du Rhône", shortName: "DDETS69" },
  });

  await prisma.quality.createMany({
    data: [
      { code: "REQ", name: "Requérant" },
      { code: "DEF", name: "Défendeur" },
    ],
  });

  await prisma.status.createMany({
    data: [
      { id: 1, label: DEFAULT_STATUS_LABEL, category: "AUDIENCE", groupId: 1 },
      { id: 2, label: "Clôture d'instruction", category: "INSTRUCTION", groupId: 2 },
    ],
  });

  // Actors. `displayName` / `displayNameNormalized` are GENERATED columns
  // computed by Postgres, so they are never written here.
  await prisma.actor.createMany({
    data: [
      {
        id: 1,
        actorType: "NATURAL_PERSON",
        firstName: "Jean",
        lastName: "DUPONT",
        qualityCode: "REQ",
      },
      {
        id: 2,
        actorType: "NATURAL_PERSON",
        firstName: "Awa",
        lastName: "DIALLO",
        qualityCode: "REQ",
      },
      {
        id: 3,
        actorType: "LEGAL_PERSON",
        legalEntityName: "PRÉFECTURE DU RHÔNE",
        qualityCode: "DEF",
      },
    ],
  });

  // Two case files at the default status (visible on first load) + one at
  // another status (hidden by the default filter).
  await prisma.caseFile.createMany({
    data: [
      {
        caseFileNumber: "2400001",
        depositDate: new Date("2024-01-15"),
        assignedToLegalEntityDivisionId: 1,
        lastStatusId: 1,
        lastStatusDate: new Date("2024-02-01"),
        mainClaimantId: 1,
        mainDefenderId: 3,
        isDeleted: false,
      },
      {
        caseFileNumber: "2400002",
        depositDate: new Date("2024-03-10"),
        assignedToLegalEntityDivisionId: 1,
        lastStatusId: 1,
        lastStatusDate: new Date("2024-03-20"),
        mainClaimantId: 2,
        mainDefenderId: 3,
        isDeleted: false,
      },
      {
        caseFileNumber: "2400003",
        depositDate: new Date("2024-04-05"),
        assignedToLegalEntityDivisionId: 1,
        lastStatusId: 2,
        lastStatusDate: new Date("2024-04-12"),
        mainClaimantId: 1,
        mainDefenderId: 3,
        isDeleted: false,
      },
    ],
  });

  console.log("[seed] test database seeded (3 case files, 2 at the default status)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
