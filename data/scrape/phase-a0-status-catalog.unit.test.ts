import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { phaseA0 } from "./phase-a0-status-catalog";
import type { Args, ScrapeDeps } from "./pipeline";
import { fakeTelerecoursClient } from "../test-support/fake-client";

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

describe("phaseA0", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("fetches ALL status groups and upserts the catalogue", async () => {
    const client = fakeTelerecoursClient({
      getStatusGroups: vi.fn().mockResolvedValue([
        {
          id: 5,
          label: "Inscrit au rôle d'une audience",
          category: "C4",
          statusList: [12],
        },
      ]),
    });
    const deps: ScrapeDeps = { prisma, client, rateLimitMs: 0 };

    await phaseA0(baseArgs, deps);

    expect(client.getStatusGroups).toHaveBeenCalledWith("TA069", "ALL");
    expect(prisma.status.upsert).toHaveBeenCalledOnce();
  });
});
