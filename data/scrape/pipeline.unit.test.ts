import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { runScrape } from "./pipeline";
import { fakeTelerecoursClient } from "../test-support/fake-client";
import { caseFileFixture, page } from "../test-support/fixtures";
import type { Args } from "./pipeline";

const baseArgs: Args = {
  jurisdiction: "TA069",
  page: 0,
  size: 30,
  all: false,
  legalEntityDivisionIds: [2488],
  anonymize: true,
  skipEnrichment: true,
  updatePieceNumbers: false,
  classify: false,
  classifyOverwrite: false,
};

describe("runScrape", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.jurisdiction.upsert.mockResolvedValue({ id: 1, name: "", shortName: "TA069" });
    prisma.caseFile.updateMany.mockResolvedValue({ count: 0 });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("runs phase A.0 before phase A", async () => {
    const client = fakeTelerecoursClient({
      getStatusGroups: vi.fn().mockResolvedValue([
        {
          id: 5,
          label: "Inscrit au rôle d'une audience",
          category: "C4",
          statusList: [12],
        },
      ]),
      getCaseFiles: vi
        .fn()
        .mockResolvedValue(page([caseFileFixture({ caseFileNumber: "TA069-001" })])),
    });

    const code = await runScrape(baseArgs, { prisma, client, rateLimitMs: 0 });

    expect(code).toBe(0);
    expect(client.getStatusGroups).toHaveBeenCalledWith("TA069", "ALL");
    expect(prisma.status.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.caseFile.upsert).toHaveBeenCalledOnce();
  });

  it("skips phase D unless --classify is passed", async () => {
    const client = fakeTelerecoursClient({
      getCaseFiles: vi
        .fn()
        .mockResolvedValue(page([caseFileFixture({ caseFileNumber: "TA069-001" })])),
    });

    await runScrape(baseArgs, { prisma, client, rateLimitMs: 0 });

    expect(prisma.caseFile.findMany).not.toHaveBeenCalled();
  });

  it("runs phase D on the scraped perimeter when --classify is passed", async () => {
    const client = fakeTelerecoursClient({
      getCaseFiles: vi
        .fn()
        .mockResolvedValue(page([caseFileFixture({ caseFileNumber: "TA069-001" })])),
    });
    prisma.caseFile.findMany.mockResolvedValue([
      {
        caseFileNumber: "TA069-001",
        title: "DALO_Liquidation d'astreinte",
        litigationType: null,
        rightType: null,
        summary: null,
        lastDecisionReading: null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    await runScrape({ ...baseArgs, classify: true }, { prisma, client, rateLimitMs: 0 });

    expect(prisma.caseFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          jurisdiction: { shortName: "TA069" },
          assignedToLegalEntityDivisionId: { in: [2488] },
        },
      }),
    );
    expect(prisma.caseFile.update).toHaveBeenCalledWith({
      where: { caseFileNumber: "TA069-001" },
      data: {
        litigationType: "LIQUIDATION_ASTREINTE",
        rightType: "DALO",
        summary: "Liquidation d'astreinte",
      },
    });
  });
});
