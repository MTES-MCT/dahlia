import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { linkRelatedCaseFiles } from "./phase-c-related";
import { fakeTelerecoursClient } from "../test-support/fake-client";

const KEY = { jurisdictionCode: "TA069", caseFileNumber: "2401234" };

describe("linkRelatedCaseFiles", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.relatedCaseFile.deleteMany.mockResolvedValue({ count: 0 });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  function clientReporting(caseFileNumbers: string[]) {
    return fakeTelerecoursClient({
      getCaseFileRelatedReport: vi
        .fn()
        .mockResolvedValue({
          accessibleCaseFiles: caseFileNumbers.map((n) => ({ caseFileNumber: n })),
        }),
    });
  }

  it("cherche le dossier lié dans le même tribunal", async () => {
    prisma.caseFile.findUnique.mockResolvedValue({ caseFileNumber: "2405678" } as never);

    const result = await linkRelatedCaseFiles(prisma, clientReporting(["2405678"]), KEY, "TA069");

    expect(result).toEqual({ linked: 1, orphans: 0 });
    expect(prisma.caseFile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jurisdictionCode_caseFileNumber: { jurisdictionCode: "TA069", caseFileNumber: "2405678" },
        },
      }),
    );
    expect(prisma.relatedCaseFile.deleteMany).not.toHaveBeenCalled();
  });

  it("supprime avec --force les liens absents du rapport Télérecours", async () => {
    prisma.caseFile.findUnique.mockResolvedValue({ caseFileNumber: "2405678" } as never);

    await linkRelatedCaseFiles(prisma, clientReporting(["2405678"]), KEY, "TA069", true);

    expect(prisma.relatedCaseFile.deleteMany).toHaveBeenCalledWith({
      where: { ...KEY, relatedCaseFileNumber: { notIn: ["2405678"] } },
    });
  });
});
