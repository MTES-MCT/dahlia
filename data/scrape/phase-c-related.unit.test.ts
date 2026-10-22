import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { linkRelatedCaseFiles } from "./phase-c-related";
import { fakeTelerecoursClient } from "../test-support/fake-client";
import { caseFileDetailFixture } from "../test-support/fixtures";
import type { TelerecoursClient } from "../telerecours/client.interface";

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
      getCaseFileRelatedReport: vi.fn().mockResolvedValue({
        accessibleCaseFiles: caseFileNumbers.map((n) => ({ caseFileNumber: n })),
      }),
    });
  }

  it("cherche le dossier lié dans le même tribunal", async () => {
    prisma.caseFile.findUnique.mockResolvedValue({ caseFileNumber: "2405678" } as never);

    const result = await linkRelatedCaseFiles(prisma, clientReporting(["2405678"]), KEY, "TA069");

    expect(result).toEqual({ linked: 1, orphans: 0, imported: 0 });
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

  describe("dossier lié absent en DB", () => {
    const IMPORT = {
      anonymize: false,
      enrich: false,
      updatePieceName: false,
    };

    beforeEach(() => {
      prisma.caseFile.findUnique.mockResolvedValue(null);
      prisma.jurisdiction.upsert.mockResolvedValue({ id: 1, jurisdictionCode: "TA069" } as never);
    });

    function clientWithDetail(over: Partial<TelerecoursClient> = {}) {
      return fakeTelerecoursClient({
        getCaseFileRelatedReport: vi
          .fn()
          .mockResolvedValue({ accessibleCaseFiles: [{ caseFileNumber: "2405678" }] }),
        getCaseFileDetail: vi
          .fn()
          .mockResolvedValue(caseFileDetailFixture({ caseFileNumber: "2405678" })),
        ...over,
      });
    }

    it("importe le dossier depuis son détail Télérecours puis le lie", async () => {
      const client = clientWithDetail();

      const result = await linkRelatedCaseFiles(prisma, client, KEY, "TA069", false, IMPORT);

      expect(result).toEqual({ linked: 1, orphans: 0, imported: 1 });
      expect(client.getCaseFileDetail).toHaveBeenCalledWith("2405678", "TA069");
      expect(prisma.caseFile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            jurisdictionCode_caseFileNumber: {
              jurisdictionCode: "TA069",
              caseFileNumber: "2405678",
            },
          },
        }),
      );
      expect(prisma.caseFile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: "Recours DALO" }) }),
      );
      expect(client.getCaseFileMeasures).not.toHaveBeenCalled();
      expect(prisma.relatedCaseFile.upsert).toHaveBeenCalledTimes(1);
    });

    it("enrichit aussi les éléments liés avec --enrich all", async () => {
      const client = clientWithDetail();

      const result = await linkRelatedCaseFiles(prisma, client, KEY, "TA069", false, {
        ...IMPORT,
        enrich: true,
      });

      expect(result).toEqual({ linked: 1, orphans: 0, imported: 1 });
      expect(client.getCaseFileActors).toHaveBeenCalledWith("2405678", "TA069", 0);
      expect(client.getCaseFileMeasures).toHaveBeenCalledWith("2405678", "TA069", 0);
      expect(client.getCaseFileAttachedFiles).toHaveBeenCalledWith("2405678", "TA069", 0);
      expect(prisma.relatedCaseFile.upsert).toHaveBeenCalledTimes(1);
    });

    it("avertit et passe au suivant quand Télérecours refuse le dossier", async () => {
      const client = clientWithDetail({
        getCaseFileDetail: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
      });

      const result = await linkRelatedCaseFiles(prisma, client, KEY, "TA069", false, IMPORT);

      expect(result).toEqual({ linked: 0, orphans: 1, imported: 0 });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("403 Forbidden"));
      expect(prisma.relatedCaseFile.upsert).not.toHaveBeenCalled();
    });

    it("ne lie pas un dossier dont le détail n'a pas les champs requis", async () => {
      const client = clientWithDetail({
        getCaseFileDetail: vi
          .fn()
          .mockResolvedValue(
            caseFileDetailFixture({ caseFileNumber: "2405678", lastStatus: undefined }),
          ),
      });

      const result = await linkRelatedCaseFiles(prisma, client, KEY, "TA069", false, IMPORT);

      expect(result).toEqual({ linked: 0, orphans: 1, imported: 0 });
      expect(prisma.caseFile.upsert).not.toHaveBeenCalled();
      expect(prisma.relatedCaseFile.upsert).not.toHaveBeenCalled();
    });
  });
});
