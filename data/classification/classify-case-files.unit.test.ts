import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import {
  classifyCaseFiles,
  classificationInputOf,
  planCaseFileUpdate,
  type CaseFileClassificationState,
} from "./classify-case-files";
import type { ClassificationResult } from "./types";

const caseFile = (
  overrides: Partial<CaseFileClassificationState> = {},
): CaseFileClassificationState => ({
  caseFileNumber: "TA069-001",
  title: "DALO_Liquidation d'astreinte",
  litigationType: null,
  rightType: null,
  summary: null,
  lastDecisionReading: null,
  ...overrides,
});

const result = (overrides: Partial<ClassificationResult> = {}): ClassificationResult => ({
  matches: [],
  ...overrides,
});

describe("classificationInputOf", () => {
  it("exposes the title and the last decision reading as fields", () => {
    expect(
      classificationInputOf(
        caseFile({
          title: "DAHO",
          lastDecisionReading: { nature: "Ordonnance", operativePart: "Rejet" },
        }),
      ),
    ).toEqual({ title: "DAHO", decision: "Ordonnance Rejet" });
  });

  it("leaves the decision field empty when there is no decision reading", () => {
    expect(classificationInputOf(caseFile()).decision).toBeNull();
  });
});

describe("planCaseFileUpdate", () => {
  it("fills empty fields", () => {
    const update = planCaseFileUpdate(
      caseFile(),
      result({ litigationType: "LIQUIDATION_ASTREINTE", rightType: "DALO", summary: "Astreinte" }),
      false,
    );
    expect(update).toEqual({
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DALO",
      summary: "Astreinte",
    });
  });

  it("keeps existing values when overwrite is off", () => {
    const update = planCaseFileUpdate(
      caseFile({ litigationType: "INJONCTION", summary: "Saisi à la main" }),
      result({ litigationType: "LIQUIDATION_ASTREINTE", rightType: "DALO", summary: "Astreinte" }),
      false,
    );
    expect(update).toEqual({ rightType: "DALO" });
  });

  it("replaces existing values when overwrite is on", () => {
    const update = planCaseFileUpdate(
      caseFile({ litigationType: "INJONCTION", summary: "Saisi à la main" }),
      result({ litigationType: "LIQUIDATION_ASTREINTE", summary: "Astreinte" }),
      true,
    );
    expect(update).toEqual({ litigationType: "LIQUIDATION_ASTREINTE", summary: "Astreinte" });
  });

  it("never writes an attribute the rules did not produce", () => {
    expect(planCaseFileUpdate(caseFile(), result({ rightType: "DALO" }), true)).toEqual({
      rightType: "DALO",
    });
  });

  it("returns an empty update when the stored value already matches", () => {
    expect(
      planCaseFileUpdate(caseFile({ rightType: "DALO" }), result({ rightType: "DALO" }), true),
    ).toEqual({});
  });
});

describe("classifyCaseFiles", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("scopes the query to the jurisdiction and the divisions", async () => {
    prisma.caseFile.findMany.mockResolvedValue([]);

    await classifyCaseFiles(prisma, {
      jurisdiction: "TA069",
      legalEntityDivisionIds: [2488],
      overwrite: false,
    });

    expect(prisma.caseFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          jurisdiction: { shortName: "TA069" },
          assignedToLegalEntityDivisionId: { in: [2488] },
        },
      }),
    );
  });

  it("omits the filters that are not configured", async () => {
    prisma.caseFile.findMany.mockResolvedValue([]);

    await classifyCaseFiles(prisma, { overwrite: false });

    expect(prisma.caseFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isDeleted: false } }),
    );
  });

  it("writes only the deduced fields and reports the counts", async () => {
    prisma.caseFile.findMany.mockResolvedValue([
      caseFile({ caseFileNumber: "TA069-001", title: "DALO LIQUIDATION ASTREINTE" }),
      caseFile({ caseFileNumber: "TA069-002", title: "POLICE: Suspension permis de conduire" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const stats = await classifyCaseFiles(prisma, { overwrite: false });

    expect(prisma.caseFile.update).toHaveBeenCalledExactlyOnceWith({
      where: { caseFileNumber: "TA069-001" },
      data: {
        litigationType: "LIQUIDATION_ASTREINTE",
        rightType: "DALO",
        summary: "Liquidation d'astreinte",
      },
    });
    expect(stats).toMatchObject({
      scanned: 2,
      matched: 1,
      updated: 1,
      fields: { litigationType: 1, rightType: 1, summary: 1 },
      unmatched: [{ caseFileNumber: "TA069-002" }],
    });
  });

  it("does not rewrite a field that already has a value", async () => {
    prisma.caseFile.findMany.mockResolvedValue([
      caseFile({ litigationType: "INJONCTION", summary: "Saisi à la main" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const stats = await classifyCaseFiles(prisma, { overwrite: false });

    expect(prisma.caseFile.update).toHaveBeenCalledExactlyOnceWith({
      where: { caseFileNumber: "TA069-001" },
      data: { rightType: "DALO" },
    });
    expect(stats.fields).toEqual({ litigationType: 0, rightType: 1, summary: 0 });
  });

  it("rewrites every deduced field when overwrite is on", async () => {
    prisma.caseFile.findMany.mockResolvedValue([
      caseFile({ litigationType: "INJONCTION", summary: "Saisi à la main" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    await classifyCaseFiles(prisma, { overwrite: true });

    expect(prisma.caseFile.update).toHaveBeenCalledExactlyOnceWith({
      where: { caseFileNumber: "TA069-001" },
      data: {
        litigationType: "LIQUIDATION_ASTREINTE",
        rightType: "DALO",
        summary: "Liquidation d'astreinte",
      },
    });
  });

  it("writes nothing in dry-run but still reports what would change", async () => {
    prisma.caseFile.findMany.mockResolvedValue([
      caseFile(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const stats = await classifyCaseFiles(prisma, { overwrite: false, dryRun: true });

    expect(prisma.caseFile.update).not.toHaveBeenCalled();
    expect(stats.updated).toBe(1);
  });
});
