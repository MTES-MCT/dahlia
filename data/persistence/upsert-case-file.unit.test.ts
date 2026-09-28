import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { upsertCaseFile } from "./upsert-case-file";
import { caseFileFixture } from "../test-support/fixtures";

describe("upsertCaseFile", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("stores a null division when Telerecours omits assignedToLegalEntityDivision", async () => {
    const upserted = await upsertCaseFile(
      prisma,
      caseFileFixture({ assignedToLegalEntityDivision: undefined }),
      false,
      1,
    );

    expect(upserted).toBe(true);
    expect(prisma.legalEntityDivision.upsert).not.toHaveBeenCalled();
    expect(prisma.caseFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ assignedToLegalEntityDivisionId: null }),
        update: expect.objectContaining({ assignedToLegalEntityDivisionId: null }),
      }),
    );
  });

  it("keeps the division id when the payload provides one", async () => {
    const upserted = await upsertCaseFile(prisma, caseFileFixture(), false, 1);

    expect(upserted).toBe(true);
    expect(prisma.legalEntityDivision.upsert).toHaveBeenCalledOnce();
    expect(prisma.caseFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ assignedToLegalEntityDivisionId: 2488 }),
        update: expect.objectContaining({ assignedToLegalEntityDivisionId: 2488 }),
      }),
    );
  });
});
