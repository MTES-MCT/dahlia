import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  resetTestDatabase,
  setupTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";
import { actorFixture } from "@/data/test-support/fixtures";
import { upsertCaseFileActorLink } from "./upsert-case-file-actors";

const prisma = testPrisma as unknown as PrismaClient;
const CASE_FILE_NUMBER = "2600503";

async function seedCaseFile(jurisdictionCode: string): Promise<void> {
  await testPrisma.caseFile.create({
    data: {
      jurisdictionCode,
      caseFileNumber: CASE_FILE_NUMBER,
      lastStatusId: 5,
      lastStatusDate: new Date("2026-01-10T00:00:00Z"),
    },
  });
}

// The "one main claimant / defender per case file" partial unique indexes are
// hand-written SQL (not in the Prisma schema): they must be scoped by court.
describe("upsertCaseFileActorLink (integration)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await testPrisma.status.create({
      data: { id: 5, label: "En cours", category: "INSTRUCTION", groupId: 2 },
    });
    await seedCaseFile("TA034");
    await seedCaseFile("TA069");
  });

  it("accepte un requérant et un défendeur principaux par dossier de même numéro dans deux tribunaux", async () => {
    for (const jurisdictionCode of ["TA034", "TA069"]) {
      const key = { jurisdictionCode, caseFileNumber: CASE_FILE_NUMBER };
      await upsertCaseFileActorLink(
        prisma,
        key,
        actorFixture({ id: 1 }),
        { isMainClaimant: true, isMainDefender: false },
        false,
      );
      await upsertCaseFileActorLink(
        prisma,
        key,
        actorFixture({ id: 2 }),
        { isMainClaimant: false, isMainDefender: true },
        false,
      );
    }

    expect(
      await testPrisma.caseFileActor.count({ where: { caseFileNumber: CASE_FILE_NUMBER } }),
    ).toBe(4);
  });

  it("refuse toujours deux requérants principaux dans un même dossier", async () => {
    const key = { jurisdictionCode: "TA069", caseFileNumber: CASE_FILE_NUMBER };
    await upsertCaseFileActorLink(
      prisma,
      key,
      actorFixture({ id: 1 }),
      { isMainClaimant: true, isMainDefender: false },
      false,
    );
    await testPrisma.actor.create({
      data: { jurisdictionCode: "TA069", id: 3, actorType: "NATURAL_PERSON" },
    });

    await expect(
      testPrisma.caseFileActor.create({
        data: { ...key, actorId: 3, qualityCode: "R", isMainClaimant: true },
      }),
    ).rejects.toThrow();
  });
});
