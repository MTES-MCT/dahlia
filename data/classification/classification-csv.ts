import type { CaseFileClassificationUpdate, UnmatchedCaseFile } from "./classify-case-files";

// One line of the dry-run/verbose report, in the shape the CSV export needs.
export interface ClassificationChange {
  caseFileNumber: string;
  title: string | null;
  update: CaseFileClassificationUpdate;
  // Ids of the rules that produced the classification, in match order.
  ruleIds: string[];
}

const CSV_HEADER = ["caseFileNumber", "title", "litigationType", "rightType", "summary", "rules"];

// RFC 4180 quoting: wrap in double quotes and double the inner ones as soon as
// the value carries a separator, a quote or a newline.
function csvCell(value: string | null | undefined): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(cells: (string | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

// Render the whole classification run as a CSV document: first the classified
// case files — same content as the `[dry-run] <number>: <title>, <changes>
// (<rules>)` log lines, one column per field — then every case file the rules
// said nothing about, with only its number and title filled in. A leading BOM
// keeps the accents readable when opened in Excel.
export function toClassificationCsv(
  changes: readonly ClassificationChange[],
  unmatched: readonly UnmatchedCaseFile[] = [],
): string {
  const lines = [csvLine(CSV_HEADER)];
  for (const change of changes) {
    lines.push(
      csvLine([
        change.caseFileNumber,
        change.title,
        change.update.litigationType,
        change.update.rightType,
        change.update.summary,
        change.ruleIds.join(" + "),
      ]),
    );
  }
  for (const caseFile of unmatched) {
    lines.push(csvLine([caseFile.caseFileNumber, caseFile.title, "", "", "", ""]));
  }
  return `﻿${lines.join("\n")}\n`;
}
