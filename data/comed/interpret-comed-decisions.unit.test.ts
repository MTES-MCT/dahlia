import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import type { DocumentIaClient } from "../document-ia/client";
import { fakeTelerecoursClient } from "../test-support/fake-client";
import {
  comedCaseFileScope,
  detectMimeType,
  interpretComedDecisions,
  interpretationFromExecution,
  missingComedFields,
  unsupportedFileReason,
} from "./interpret-comed-decisions";

const PDF = Buffer.from("%PDF-1.7 …");

function attachedFile(encodedFileId: string, caseFileNumber = "2500001") {
  return {
    encodedFileId,
    jurisdictionCode: "TA034",
    caseFileNumber,
    fileName: `${encodedFileId}.pdf`,
    fileTypeLabel: "Pièce",
    eventCreationDate: new Date("2025-11-04"),
    dahliaNameNormalized: "decision comed",
    fileNameNormalized: "decision comed.pdf",
  };
}

const comedMetadata = {
  numero_recours: "2024-034-001185",
  date_decision: "2025-09-09",
  sens_decision: "rejet",
};

describe("detectMimeType", () => {
  it("recognises PDF, JPEG and PNG from their magic bytes", () => {
    expect(detectMimeType(PDF, "application/octet-stream")).toBe("application/pdf");
    expect(detectMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      "image/png",
    );
  });

  it("falls back to the content-type header without parameters", () => {
    expect(detectMimeType(Buffer.from("PK.."), "application/zip; charset=binary")).toBe(
      "application/zip",
    );
    expect(detectMimeType(Buffer.from("??"))).toBeUndefined();
  });
});

describe("unsupportedFileReason", () => {
  it("rejects unsupported formats and oversized files", () => {
    expect(unsupportedFileReason(PDF, "application/pdf")).toBeNull();
    expect(unsupportedFileReason(PDF, "application/msword")).toMatch(/Format non supporté/);
    expect(unsupportedFileReason(Buffer.alloc(26 * 1024 * 1024), "application/pdf")).toMatch(
      /trop volumineux/,
    );
  });
});

describe("interpretationFromExecution", () => {
  it("keeps classification and flattened extraction, drops workflow_metadata", () => {
    const outcome = interpretationFromExecution({
      status: "SUCCESS",
      executionId: "exec-1",
      result: {
        classification: { document_type: "decision_comed", confidence: 0.95, explanation: "…" },
        extraction: {
          type: "decision_comed",
          properties: [{ name: "sens_decision", type: "object", value: "rejet" }],
        },
        workflow_metadata: [{ user_prompt: "OCR text" }],
      },
    });
    expect(outcome).toMatchObject({
      status: "SUCCESS",
      documentType: "decision_comed",
      confidence: 0.95,
      metadata: { sens_decision: "rejet" },
      executionId: "exec-1",
    });
    expect(outcome.rawResult).not.toHaveProperty("workflow_metadata");
  });

  it("maps a failed execution", () => {
    expect(
      interpretationFromExecution({ status: "FAILED", executionId: "e", errorMessage: "boom" }),
    ).toMatchObject({ status: "FAILED", errorMessage: "boom", documentType: null });
  });
});

describe("missingComedFields", () => {
  it("lists the required fields left empty", () => {
    expect(missingComedFields(comedMetadata)).toEqual([]);
    expect(missingComedFields({ numero_recours: "", sens_decision: null })).toEqual([
      "numero_recours",
      "date_decision",
      "sens_decision",
    ]);
  });
});

describe("comedCaseFileScope", () => {
  it("excludes deleted dossiers, and closed ones when ongoing", () => {
    expect(comedCaseFileScope("all", ["Terminé"])).toEqual({ isDeleted: false });
    expect(comedCaseFileScope("ongoing", ["Terminé"])).toEqual({
      isDeleted: false,
      lastStatus: { label: { notIn: ["Terminé"] } },
    });
  });
});

describe("interpretComedDecisions", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let documentIa: DocumentIaClient;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.caseFile.findMany.mockResolvedValue([]);
    documentIa = {
      workflowId: "wf",
      interpret: vi.fn().mockResolvedValue({
        status: "SUCCESS",
        executionId: "exec",
        result: {
          classification: { document_type: "decision_comed", confidence: 0.9, explanation: "" },
          extraction: {
            type: "decision_comed",
            properties: Object.entries(comedMetadata).map(([name, value]) => ({
              name,
              value,
              type: "string",
            })),
          },
        },
      }),
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("skips pièces already interpreted and stores the new interpretations", async () => {
    prisma.attachedFile.findMany.mockResolvedValue([
      attachedFile("A1"),
      attachedFile("A2"),
    ] as never);
    prisma.attachedFileInterpretation.findMany.mockResolvedValue([
      { jurisdictionCode: "TA034", encodedFileId: "A1" },
    ] as never);
    const client = fakeTelerecoursClient({
      downloadFile: vi.fn().mockResolvedValue({ data: PDF, mimeType: "application/octet-stream" }),
    });

    const stats = await interpretComedDecisions(prisma, {
      filter: { caseFile: { isDeleted: false } },
      force: false,
      documentIa,
      getTelerecoursClient: () => client,
      rateLimitMs: 0,
    });

    expect(stats).toMatchObject({ candidates: 2, alreadyInterpreted: 1, confirmed: 1 });
    expect(prisma.attachedFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { caseFile: { isDeleted: false } } }),
    );
    expect(client.downloadFile).toHaveBeenCalledOnce();
    expect(client.downloadFile).toHaveBeenCalledWith("A2", "TA034");
    expect(documentIa.interpret).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "application/pdf" }),
      expect.objectContaining({ documentTypes: ["decision_comed"] }),
    );
    expect(prisma.attachedFileInterpretation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jurisdictionCode_encodedFileId: { jurisdictionCode: "TA034", encodedFileId: "A2" },
        },
        create: expect.objectContaining({
          status: "SUCCESS",
          documentType: "decision_comed",
          metadata: comedMetadata,
          workflowId: "wf",
        }),
      }),
    );
  });

  it("re-interprets everything with force, and records skips and failures", async () => {
    prisma.attachedFile.findMany.mockResolvedValue([
      attachedFile("A1"),
      attachedFile("A2"),
      attachedFile("A3"),
    ] as never);
    const client = fakeTelerecoursClient({
      downloadFile: vi
        .fn()
        .mockResolvedValueOnce({ data: PDF })
        .mockResolvedValueOnce({ data: Buffer.from("PK.."), mimeType: "application/zip" })
        .mockRejectedValueOnce(new Error("GET … → 500")),
    });

    const stats = await interpretComedDecisions(prisma, {
      filter: {},
      force: true,
      documentIa,
      getTelerecoursClient: () => client,
      rateLimitMs: 0,
    });

    expect(prisma.attachedFileInterpretation.findMany).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ candidates: 3, confirmed: 1, skipped: 1, failed: 1 });
    const statuses = prisma.attachedFileInterpretation.upsert.mock.calls.map(
      ([call]) => call.create.status,
    );
    expect(statuses).toEqual(["SUCCESS", "SKIPPED", "FAILED"]);
  });

  it("counts case files with several confirmed decisions", async () => {
    prisma.attachedFile.findMany.mockResolvedValue([
      attachedFile("A1", "2500001"),
      attachedFile("A2", "2500001"),
    ] as never);
    prisma.attachedFileInterpretation.findMany.mockResolvedValue([]);
    const client = fakeTelerecoursClient({
      downloadFile: vi.fn().mockResolvedValue({ data: PDF }),
    });

    const stats = await interpretComedDecisions(prisma, {
      filter: {},
      force: false,
      documentIa,
      getTelerecoursClient: () => client,
      rateLimitMs: 0,
    });

    expect(stats).toMatchObject({ confirmed: 2, multipleDecisionCaseFiles: 1 });
  });
});

describe("interpretComedDecisions anonymization", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let documentIa: DocumentIaClient;
  const client = () =>
    fakeTelerecoursClient({ downloadFile: vi.fn().mockResolvedValue({ data: PDF }) });

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.caseFile.findMany.mockResolvedValue([]);
    prisma.attachedFile.findMany.mockResolvedValue([attachedFile("A1")] as never);
    prisma.attachedFileInterpretation.findMany.mockResolvedValue([]);
    documentIa = {
      workflowId: "wf",
      interpret: vi.fn().mockResolvedValue({
        status: "SUCCESS",
        executionId: "exec",
        result: {
          classification: { document_type: "decision_comed", confidence: 0.9, explanation: "" },
          extraction: {
            type: "decision_comed",
            properties: [
              ...Object.entries(comedMetadata).map(([name, value]) => ({
                name,
                value,
                type: "string",
              })),
              { name: "demandeur", type: "string", value: "MARTIN Lucie" },
            ],
          },
        },
      }),
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ENVIRONMENT", "test");
    vi.stubEnv("NO_ANONYMIZE", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function storedRow(telerecours = client()) {
    await interpretComedDecisions(prisma, {
      filter: {},
      force: false,
      documentIa,
      getTelerecoursClient: () => telerecours,
      rateLimitMs: 0,
    });
    return prisma.attachedFileInterpretation.upsert.mock.calls[0]![0].create;
  }

  it("sends the real Télérecours pièce and stores an anonymized answer outside production", async () => {
    const telerecours = client();
    const row = await storedRow(telerecours);
    expect(telerecours.downloadFile).toHaveBeenCalledWith("A1", "TA034");
    expect(documentIa.interpret).toHaveBeenCalledWith(
      expect.objectContaining({ data: PDF }),
      expect.anything(),
    );
    expect(JSON.stringify(row)).not.toMatch(/MARTIN|Lucie/);
    expect(row.metadata).toMatchObject(comedMetadata);
  });

  it("stores the answer as is in production", async () => {
    vi.stubEnv("ENVIRONMENT", "production");
    expect((await storedRow()).metadata).toMatchObject({ demandeur: "MARTIN Lucie" });
  });

  it("stores the answer as is with NO_ANONYMIZE=true", async () => {
    vi.stubEnv("NO_ANONYMIZE", "true");
    expect((await storedRow()).metadata).toMatchObject({ demandeur: "MARTIN Lucie" });
  });
});
