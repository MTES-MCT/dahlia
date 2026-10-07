import { describe, expect, it } from "vitest";
import { toComedDecisionCsv } from "./comed-decision-csv";
import type { ComedDecision } from "./match-comed-decision";

const decision = (overrides: Partial<ComedDecision> = {}): ComedDecision => ({
  jurisdictionCode: "TA069",
  caseFileNumber: "2400123",
  caseFileTitle: "DALO injonction",
  encodedFileId: "abc",
  fileName: "3_COMED_23.12.25.pdf",
  fileTypeLabel: "Notification",
  eventCreationDate: new Date("2025-12-23T00:00:00.000Z"),
  verdict: "certain",
  ...overrides,
});

describe("toComedDecisionCsv", () => {
  it("writes a header and one line per pièce", () => {
    expect(toComedDecisionCsv([decision()])).toBe(
      "﻿jurisdictionCode,caseFileNumber,caseFileTitle,encodedFileId,fileName,fileTypeLabel,eventCreationDate,decision_comed\n" +
        "TA069,2400123,DALO injonction,abc,3_COMED_23.12.25.pdf,Notification,2025-12-23T00:00:00.000Z,certain\n",
    );
  });

  it("quotes a title that contains a comma or a quote", () => {
    const csv = toComedDecisionCsv([decision({ caseFileTitle: 'DALO, "injonction"' })]);
    expect(csv.split("\n")[1]).toBe(
      'TA069,2400123,"DALO, ""injonction""",abc,3_COMED_23.12.25.pdf,Notification,2025-12-23T00:00:00.000Z,certain',
    );
  });

  it("emits only the header when nothing matched", () => {
    expect(toComedDecisionCsv([])).toBe(
      "﻿jurisdictionCode,caseFileNumber,caseFileTitle,encodedFileId,fileName,fileTypeLabel,eventCreationDate,decision_comed\n",
    );
  });
});
