import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { phaseA, reconcileDeleted } from "./phase-a-list";
import type { Args, ScrapeDeps } from "./pipeline";
import { fakeTelerecoursClient } from "../test-support/fake-client";
import { caseFileFixture, page } from "../test-support/fixtures";

const baseArgs: Args = {
  jurisdiction: "TA069",
  page: 0,
  size: 30,
  all: false,
  legalEntityDivisionIds: [2488],
  anonymize: true,
  skipEnrichment: false,
  updatePieceNumbers: false,
  classify: false,
  classifyOverwrite: false,
};

function makeDeps(
  prisma: DeepMockProxy<PrismaClient>,
  client = fakeTelerecoursClient(),
): ScrapeDeps {
  return { prisma, client, rateLimitMs: 0 };
}

describe("phaseA", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.jurisdiction.upsert.mockResolvedValue({ id: 1, name: "", shortName: "TA069" });
    // Silence the script's progress logs during tests.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("upserts every listed case file and returns them as seen", async () => {
    const client = fakeTelerecoursClient({
      getCaseFiles: vi
        .fn()
        .mockResolvedValue(page([caseFileFixture({ caseFileNumber: "TA069-001" })])),
    });

    const res = await phaseA(baseArgs, makeDeps(prisma, client));

    expect(res).toMatchObject({ processed: 1, upserted: 1, seen: ["TA069-001"] });
    expect(prisma.caseFile.upsert).toHaveBeenCalledOnce();
    // Without --all, phase A restricts the list to the INPROGRESS status groups.
    expect(client.getInProgressStatusGroupIds).toHaveBeenCalledWith("TA069");
  });

  it("tags every upserted case file with the scraped jurisdiction", async () => {
    prisma.jurisdiction.upsert.mockResolvedValue({ id: 42, name: "", shortName: "TA075" });
    const client = fakeTelerecoursClient({
      getCaseFiles: vi
        .fn()
        .mockResolvedValue(page([caseFileFixture({ caseFileNumber: "TA075-001" })])),
    });

    await phaseA({ ...baseArgs, jurisdiction: "TA075" }, makeDeps(prisma, client));

    // The jurisdiction row is resolved once per run, keyed on its Telerecours
    // code, and left with an empty name (edited manually later).
    expect(prisma.jurisdiction.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { shortName: "TA075" },
      update: {},
      create: { shortName: "TA075" },
    });
    expect(prisma.caseFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ jurisdictionId: 42 }),
        update: expect.objectContaining({ jurisdictionId: 42 }),
      }),
    );
  });

  it("skips a case file missing a required field without failing the run", async () => {
    const client = fakeTelerecoursClient({
      getCaseFiles: vi
        .fn()
        .mockResolvedValue(
          page([caseFileFixture({ caseFileNumber: "TA069-002", mainClaimant: undefined })]),
        ),
    });

    const res = await phaseA(baseArgs, makeDeps(prisma, client));

    // Still "seen" (it exists in Telerecours) but not upserted.
    expect(res).toMatchObject({ processed: 1, upserted: 0, seen: ["TA069-002"] });
    expect(prisma.caseFile.upsert).not.toHaveBeenCalled();
  });

  it("walks every page until totalPages is reached", async () => {
    const getCaseFiles = vi
      .fn()
      .mockResolvedValueOnce(page([caseFileFixture({ caseFileNumber: "A" })], 2, 0))
      .mockResolvedValueOnce(page([caseFileFixture({ caseFileNumber: "B" })], 2, 1));
    const client = fakeTelerecoursClient({ getCaseFiles });

    const res = await phaseA(baseArgs, makeDeps(prisma, client));

    expect(getCaseFiles).toHaveBeenCalledTimes(2);
    expect(res.seen.sort()).toEqual(["A", "B"]);
  });

  it("passes --all by skipping the INPROGRESS status filter", async () => {
    const client = fakeTelerecoursClient({
      getCaseFiles: vi.fn().mockResolvedValue(page([caseFileFixture()])),
    });

    await phaseA({ ...baseArgs, all: true }, makeDeps(prisma, client));

    expect(client.getInProgressStatusGroupIds).not.toHaveBeenCalled();
    // statusGroupIds argument (5th) must be undefined when --all.
    expect(client.getCaseFiles).toHaveBeenCalledWith("TA069", 0, 30, undefined, undefined, [2488]);
  });
});

describe("reconcileDeleted", () => {
  it("soft-deletes case files in perimeter but absent from the seen list", async () => {
    const prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "log").mockImplementation(() => {});
    prisma.caseFile.updateMany.mockResolvedValue({ count: 3 });

    const count = await reconcileDeleted(baseArgs, ["A", "B"], makeDeps(prisma));

    expect(count).toBe(3);
    const where = prisma.caseFile.updateMany.mock.calls[0][0].where!;
    expect(where).toMatchObject({
      caseFileNumber: { notIn: ["A", "B"] },
      assignedToLegalEntityDivisionId: { in: [2488] },
      isDeleted: false,
    });
  });
});
