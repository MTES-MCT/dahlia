import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildComedDecisionRows,
  toComedInterpretationCsv,
  type ComedInterpretation,
} from "./export-comed-interpretations";

function interpretation(
  caseFileNumber: string,
  encodedFileId: string,
  metadata: Prisma.JsonObject,
): ComedInterpretation {
  return {
    encodedFileId,
    metadata,
    attachedFile: {
      eventCreationDate: new Date("2026-01-01T00:00:00Z"),
      fileName: `file-${encodedFileId}.pdf`,
      dahliaName: encodedFileId === "B" ? "Décision COMED" : null,
      caseFile: {
        jurisdictionCode: "TA069",
        caseFileNumber,
        title: `Title ${caseFileNumber}`,
        litigationType: "INJONCTION",
        rightType: "DALO",
        caseFileActors: [
          { isMainClaimant: true, isMainDefender: false, actor: { displayName: "DOE John" } },
          { isMainClaimant: false, isMainDefender: true, actor: { displayName: "Préfet" } },
        ],
      },
    },
  };
}

describe("buildComedDecisionRows", () => {
  it("groups pièces by case file and by numero_recours + date_decision", () => {
    const rows = buildComedDecisionRows([
      interpretation("2601", "A", {
        numero_recours: "R1",
        date_decision: "2025-01-01",
        sens_decision: "favorable",
      }),
      interpretation("2601", "B", {
        numero_recours: "R1",
        date_decision: "2025-01-01",
        sens_decision: "prioritaire",
      }),
      interpretation("2601", "C", { numero_recours: "R2", date_decision: "2025-06-01" }),
      interpretation("2602", "D", { numero_recours: "R3", date_decision: "2025-02-01" }),
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      caseFileNumber: "2601",
      claimant: "DOE John",
      defender: "Préfet",
      caseFileName: "2601 - DOE John c/ Préfet - Injonction - DALO",
      telerecoursTitle: "Title 2601",
      detectedCount: 3,
      distinctCount: 2,
      pieceCount: 2,
      encodedFileIds: ["A", "B"],
      pieceNames: ["file-A.pdf", "Décision COMED"],
      divergentParameters: ["sens_decision"],
      parameters: { numero_recours: "R1", sens_decision: "favorable | prioritaire" },
    });
    expect(rows[2]).toMatchObject({ caseFileNumber: "2602", detectedCount: 1, distinctCount: 1 });
  });
});

describe("toComedInterpretationCsv", () => {
  it("writes one line per decision with the extracted parameters as columns", () => {
    const csv = toComedInterpretationCsv(
      buildComedDecisionRows([
        interpretation("2601", "A", {
          numero_recours: "R1",
          date_decision: "2025-01-01",
          motif: "a, b",
        }),
      ]),
    );
    const [header, line] = csv.replace(/^﻿/, "").trimEnd().split("\n");
    const headerCols = header.split(",");
    expect(headerCols.slice(2, 4)).toEqual(["requerant", "defendeur"]);
    expect(headerCols.slice(-3)).toEqual(["numero_recours", "date_decision", "motif"]);
    expect(line.endsWith('R1,2025-01-01,"a, b"')).toBe(true);
  });
});
