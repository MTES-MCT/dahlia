import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import {
  applyComedDecisions,
  comedDecisionValuesOf,
  comedFieldChangesOf,
  mostRecentComedDecision,
  parseComedDate,
  parseNumeroRecours,
  planComedCaseFileUpdate,
} from "./apply-comed-decisions";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function decision(
  encodedFileId: string,
  dateDecision: string | null,
  eventCreationDate = "2025-11-04",
  numeroRecours: string | null = `R-${encodedFileId}`,
) {
  return {
    encodedFileId,
    eventCreationDate: utc(eventCreationDate),
    numeroRecours,
    dateDecision: dateDecision ? utc(dateDecision) : null,
  };
}

const emptyCaseFile = {
  jurisdictionCode: "TA034",
  caseFileNumber: "2500001",
  comDaloNumber: null,
  comedDecisionDate: null,
};

describe("parseComedDate", () => {
  it("parses ISO and French dates as UTC midnight", () => {
    expect(parseComedDate("2025-09-09")).toEqual(utc("2025-09-09"));
    expect(parseComedDate("09/09/2025")).toEqual(utc("2025-09-09"));
  });

  it("rejects invalid or missing dates", () => {
    expect(parseComedDate("2025-02-30")).toBeNull();
    expect(parseComedDate("septembre 2025")).toBeNull();
    expect(parseComedDate(null)).toBeNull();
    expect(parseComedDate(20250909)).toBeNull();
  });
});

describe("parseNumeroRecours", () => {
  it("trims, and rejects empty or too long values", () => {
    expect(parseNumeroRecours(" 2024-034-001185 ")).toBe("2024-034-001185");
    expect(parseNumeroRecours("")).toBeNull();
    expect(parseNumeroRecours("x".repeat(65))).toBeNull();
    expect(parseNumeroRecours({ value: "R1" })).toBeNull();
  });
});

describe("mostRecentComedDecision", () => {
  it("keeps the latest decision date, undated decisions last", () => {
    const latest = mostRecentComedDecision([
      decision("A1", "2024-01-10", "2025-12-01"),
      decision("A2", "2025-03-01", "2025-01-01"),
      decision("A3", null, "2026-01-01"),
    ]);
    expect(latest?.encodedFileId).toBe("A2");
  });

  it("breaks ties on the pièce deposit date", () => {
    const latest = mostRecentComedDecision([
      decision("A1", "2025-03-01", "2025-04-01"),
      decision("A2", "2025-03-01", "2025-05-01"),
    ]);
    expect(latest?.encodedFileId).toBe("A2");
    expect(mostRecentComedDecision([])).toBeNull();
  });
});

describe("planComedCaseFileUpdate", () => {
  it("fills empty fields from the decision", () => {
    expect(planComedCaseFileUpdate(emptyCaseFile, decision("A1", "2025-09-09"))).toEqual({
      comDaloNumber: "R-A1",
      comedDecisionDate: utc("2025-09-09"),
    });
  });

  it("never replaces a stored value", () => {
    expect(
      planComedCaseFileUpdate(
        { ...emptyCaseFile, comDaloNumber: "MANUAL", comedDecisionDate: utc("2020-01-01") },
        decision("A1", "2025-09-09"),
      ),
    ).toEqual({});
    expect(
      planComedCaseFileUpdate({ ...emptyCaseFile, comDaloNumber: "" }, decision("A1", null)),
    ).toEqual({ comDaloNumber: "R-A1" });
  });

  it("with overwrite, replaces stored values that differ, never clears them", () => {
    const stored = {
      ...emptyCaseFile,
      comDaloNumber: "MANUAL",
      comedDecisionDate: utc("2020-01-01"),
    };
    expect(planComedCaseFileUpdate(stored, decision("A1", "2025-09-09"), true)).toEqual({
      comDaloNumber: "R-A1",
      comedDecisionDate: utc("2025-09-09"),
    });
    expect(
      planComedCaseFileUpdate(
        { ...emptyCaseFile, comDaloNumber: "R-A1", comedDecisionDate: utc("2025-09-09") },
        decision("A1", "2025-09-09"),
        true,
      ),
    ).toEqual({});
    expect(planComedCaseFileUpdate(stored, decision("A1", null, "2025-11-04", null), true)).toEqual(
      {},
    );
  });
});

describe("comedFieldChangesOf", () => {
  it("logs one document-ia change per written field", () => {
    expect(
      comedFieldChangesOf(emptyCaseFile, {
        comDaloNumber: "R1",
        comedDecisionDate: utc("2025-09-09"),
      }),
    ).toEqual([
      {
        jurisdictionCode: "TA034",
        model: "CaseFile",
        modelId: "2500001",
        field: "comDaloNumber",
        previousValue: null,
        newValue: "R1",
        origin: "document-ia",
      },
      {
        jurisdictionCode: "TA034",
        model: "CaseFile",
        modelId: "2500001",
        field: "comedDecisionDate",
        previousValue: null,
        newValue: "2025-09-09",
        origin: "document-ia",
      },
    ]);
  });
});

describe("comedDecisionValuesOf", () => {
  it("reads the DocumentIA flattened metadata", () => {
    expect(
      comedDecisionValuesOf("A1", utc("2025-11-04"), {
        numero_recours: "2024-034-001185",
        date_decision: "2025-09-09",
      }),
    ).toEqual({
      encodedFileId: "A1",
      eventCreationDate: utc("2025-11-04"),
      numeroRecours: "2024-034-001185",
      dateDecision: utc("2025-09-09"),
    });
  });
});

describe("applyComedDecisions", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.attachedFile.findMany.mockResolvedValue([
      {
        jurisdictionCode: "TA034",
        encodedFileId: "A1",
        caseFileNumber: "2500001",
        eventCreationDate: utc("2025-01-01"),
      },
      {
        jurisdictionCode: "TA034",
        encodedFileId: "A2",
        caseFileNumber: "2500001",
        eventCreationDate: utc("2025-06-01"),
      },
    ] as never);
    prisma.attachedFileInterpretation.findMany.mockResolvedValue([
      {
        jurisdictionCode: "TA034",
        encodedFileId: "A1",
        metadata: { numero_recours: "OLD", date_decision: "2024-05-01" },
      },
      {
        jurisdictionCode: "TA034",
        encodedFileId: "A2",
        metadata: { numero_recours: "NEW", date_decision: "2025-05-01" },
      },
    ] as never);
    prisma.caseFile.findMany.mockResolvedValue([emptyCaseFile] as never);
    prisma.attachedFile.updateMany.mockResolvedValue({ count: 2 });
    prisma.attachedFile.count.mockResolvedValue(2);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("types the pièces and writes the most recent decision with its history", async () => {
    const stats = await applyComedDecisions(prisma, { filter: { jurisdictionCode: "TA034" } });

    expect(stats).toMatchObject({
      caseFilesWithDecision: 1,
      caseFilesUpdated: 1,
      fields: { comDaloNumber: 1, comedDecisionDate: 1 },
      piecesTyped: 2,
    });
    expect(prisma.attachedFile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dahliaType: "DECISION_COMED" }),
      }),
    );
    expect(prisma.caseFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { comDaloNumber: "NEW", comedDecisionDate: utc("2025-05-01") },
      }),
    );
    expect(prisma.fieldChange.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ field: "comDaloNumber", newValue: "NEW" }),
        expect.objectContaining({ field: "comedDecisionDate", newValue: "2025-05-01" }),
      ],
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("only loads case files with an empty field, unless overwrite", async () => {
    await applyComedDecisions(prisma, { filter: {} });
    const emptyOnly = prisma.caseFile.findMany.mock.calls[0]![0]!.where!.AND as unknown[];
    expect(emptyOnly).toContainEqual({
      OR: [{ comDaloNumber: null }, { comDaloNumber: "" }, { comedDecisionDate: null }],
    });

    prisma.caseFile.findMany.mockClear();
    await applyComedDecisions(prisma, { filter: {}, overwrite: true });
    const all = prisma.caseFile.findMany.mock.calls[0]![0]!.where!.AND as unknown[];
    expect(all).not.toContainEqual(expect.objectContaining({ OR: expect.anything() }));
  });

  it("writes nothing in dry-run", async () => {
    const stats = await applyComedDecisions(prisma, { filter: {}, dryRun: true });

    expect(stats).toMatchObject({ caseFilesUpdated: 1, piecesTyped: 2, piecesUntyped: 2 });
    expect(prisma.attachedFile.updateMany).not.toHaveBeenCalled();
    expect(prisma.caseFile.update).not.toHaveBeenCalled();
    expect(prisma.fieldChange.createMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
