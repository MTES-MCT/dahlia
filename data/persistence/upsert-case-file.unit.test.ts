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
    vi.mocked(console.warn).mockClear();
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

  it("warns when an already-tagged case file changes jurisdiction", async () => {
    prisma.caseFile.findUnique.mockResolvedValue({ jurisdictionId: 3 } as never);

    await upsertCaseFile(prisma, caseFileFixture({ caseFileNumber: "TA069-001" }), false, 7);

    expect(console.warn).toHaveBeenCalledWith(
      "⚠ Case file TA069-001: jurisdictionId changed from 3 to 7",
    );
    expect(prisma.caseFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ jurisdictionId: 7 }),
      }),
    );
  });

  it("does not warn when the jurisdiction stays the same or is first assigned", async () => {
    prisma.caseFile.findUnique.mockResolvedValue({ jurisdictionId: 7 } as never);
    await upsertCaseFile(prisma, caseFileFixture(), false, 7);

    prisma.caseFile.findUnique.mockResolvedValue({ jurisdictionId: null } as never);
    await upsertCaseFile(prisma, caseFileFixture(), false, 7);

    prisma.caseFile.findUnique.mockResolvedValue(null);
    await upsertCaseFile(prisma, caseFileFixture(), false, 7);

    expect(console.warn).not.toHaveBeenCalled();
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
