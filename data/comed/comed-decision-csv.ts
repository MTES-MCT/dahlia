import type { ComedDecision } from "./match-comed-decision";

const CSV_HEADER = [
  "jurisdictionCode",
  "caseFileNumber",
  "caseFileTitle",
  "encodedFileId",
  "fileName",
  "fileTypeLabel",
  "eventCreationDate",
  "decision_comed",
];

// RFC 4180 quoting: wrap in double quotes and double the inner ones as soon as
// the value carries a separator, a quote or a newline.
function csvCell(value: string | null | undefined): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(cells: (string | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

// One row per matching attached file, same grain as comed-final.sql, plus the
// case-file title loaded with the pièce. A leading BOM keeps accents readable
// in Excel.
export function toComedDecisionCsv(decisions: readonly ComedDecision[]): string {
  const lines = [csvLine(CSV_HEADER)];
  for (const decision of decisions) {
    lines.push(
      csvLine([
        decision.jurisdictionCode,
        decision.caseFileNumber,
        decision.caseFileTitle,
        decision.encodedFileId,
        decision.fileName,
        decision.fileTypeLabel,
        decision.eventCreationDate.toISOString(),
        decision.verdict,
      ]),
    );
  }
  return `﻿${lines.join("\n")}\n`;
}
