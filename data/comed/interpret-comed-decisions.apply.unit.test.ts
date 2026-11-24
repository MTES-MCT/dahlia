import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import type { DocumentIaClient } from "../document-ia/client";
import { fakeTelerecoursClient } from "../test-support/fake-client";
import { interpretComedDecisions } from "./interpret-comed-decisions";

// Per-case-file report of interpretComedDecisions (`apply` option): each case
// file is updated right after its own pièces, before the next one starts.

const PDF = Buffer.from("%PDF-1.7 …");

function attachedFile(encodedFileId: string, caseFileNumber: string) {
  return {
    encodedFileId,
    jurisdictionCode: "TA069",
    caseFileNumber,
    fileName: `${encodedFileId}.pdf`,
    fileTypeLabel: "Pièce",
    eventCreationDate: new Date("2025-11-04"),
    dahliaNameNormalized: "decision comed",
    fileNameNormalized: "decision comed.pdf",
  };
}

describe("interpretComedDecisions with apply", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let documentIa: DocumentIaClient;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    // First call: the candidates; later calls: the per-case-file reports.
    prisma.attachedFile.findMany
      .mockResolvedValueOnce([
        attachedFile("A1", "2500001"),
        attachedFile("A2", "2500001"),
        attachedFile("B1", "2500002"),
        attachedFile("C1", "2500003"),
      ] as never)
      .mockResolvedValue([]);
    // C1 was interpreted by a previous run.
    prisma.attachedFileInterpretation.findMany
      .mockResolvedValueOnce([{ jurisdictionCode: "TA069", encodedFileId: "C1" }] as never)
      .mockResolvedValue([]);
    prisma.caseFile.findMany.mockResolvedValue([]);
    prisma.attachedFile.updateMany.mockResolvedValue({ count: 1 });
    documentIa = {
      workflowId: "wf",
      interpret: vi.fn().mockResolvedValue({
        status: "SUCCESS",
        executionId: "exec",
        result: { classification: { document_type: "decision_comed", confidence: 0.9 } },
      }),
    } as unknown as DocumentIaClient;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("updates each case file before interpreting the next one", async () => {
    const client = fakeTelerecoursClient({
      downloadFile: vi.fn().mockResolvedValue({ data: PDF }),
    });

    const stats = await interpretComedDecisions(prisma, {
      filter: { jurisdictionCode: "TA069" },
      force: false,
      documentIa,
      getTelerecoursClient: () => client,
      rateLimitMs: 0,
      apply: { dryRun: false, overwrite: false },
    });

    // One report per case file, including C (nothing left to interpret).
    const typing = prisma.attachedFile.updateMany.mock.calls.filter(
      ([call]) => call.data.dahliaType === "DECISION_COMED",
    );
    expect(typing.map(([call]) => call.where?.caseFile)).toEqual([
      { AND: [{}, { jurisdictionCode: "TA069", caseFileNumber: "2500001" }] },
      { AND: [{}, { jurisdictionCode: "TA069", caseFileNumber: "2500002" }] },
      { AND: [{}, { jurisdictionCode: "TA069", caseFileNumber: "2500003" }] },
    ]);

    // Case file 2500001 is reported after A2 and before B1 is interpreted.
    const interpretOrder = vi.mocked(documentIa.interpret).mock.invocationCallOrder;
    const reportOrder = prisma.attachedFile.updateMany.mock.invocationCallOrder;
    expect(interpretOrder).toHaveLength(3);
    expect(reportOrder[0]).toBeGreaterThan(interpretOrder[1]!);
    expect(reportOrder[0]).toBeLessThan(interpretOrder[2]!);

    expect(stats.applied).toMatchObject({ piecesTyped: 3 });
  });

  it("keeps going when the report of one case file fails", async () => {
    // The report of the first case file fails.
    prisma.attachedFile.updateMany.mockRejectedValueOnce(new Error("db down"));
    const client = fakeTelerecoursClient({
      downloadFile: vi.fn().mockResolvedValue({ data: PDF }),
    });

    const stats = await interpretComedDecisions(prisma, {
      filter: {},
      force: false,
      documentIa,
      getTelerecoursClient: () => client,
      rateLimitMs: 0,
      apply: { dryRun: false, overwrite: false },
    });

    expect(documentIa.interpret).toHaveBeenCalledTimes(3);
    expect(stats.failed).toBe(1);
  });
});
