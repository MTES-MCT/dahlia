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
});
