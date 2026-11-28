import ExcelJS from "exceljs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { litigationTypeShortLabel, rightTypeLabel } from "../../app/lib/case-file-enums";
import { COMED_DOCUMENT_TYPES } from "../document-ia/client";
import { jurisdictionInstanceWhere } from "../jurisdiction-instance";
import { REQUIRED_COMED_FIELDS } from "./interpret-comed-decisions";

// Pivot identifying a distinct COMED decision within a case file.
export const COMED_DECISION_PIVOT = ["numero_recours", "date_decision"] as const;

const CASE_FILE_EXPORT_SELECT = {
  jurisdictionCode: true,
  caseFileNumber: true,
  title: true,
  litigationType: true,
  rightType: true,
  lastStatus: { select: { label: true } },
  caseFileActors: {
    where: { OR: [{ isMainClaimant: true }, { isMainDefender: true }] },
    select: {
      isMainClaimant: true,
      isMainDefender: true,
      actor: { select: { displayName: true } },
    },
  },
} as const satisfies Prisma.CaseFileSelect;

const INTERPRETATION_SELECT = {
  encodedFileId: true,
  metadata: true,
  attachedFile: {
    select: {
      eventCreationDate: true,
      fileName: true,
      dahliaName: true,
      caseFile: { select: CASE_FILE_EXPORT_SELECT },
    },
  },
} as const satisfies Prisma.AttachedFileInterpretationSelect;

export type CaseFileForComedExport = Prisma.CaseFileGetPayload<{
  select: typeof CASE_FILE_EXPORT_SELECT;
}>;

export type ComedInterpretation = Prisma.AttachedFileInterpretationGetPayload<{
  select: typeof INTERPRETATION_SELECT;
}>;

export interface ComedDecisionRow {
  jurisdictionCode: string;
  caseFileNumber: string;
  claimant: string;
  defender: string;
  caseFileName: string;
  telerecoursTitle: string;
  caseFileStatus: string;
  detectedCount: number;
  distinctCount: number;
  pieceCount: number;
  encodedFileIds: string[];
  // Same order as encodedFileIds; label shown in the app (DAHLIA name, else Télérecours filename).
  pieceNames: string[];
  // Extracted value per field; distinct values joined with " | " when the
  // pièces of the same decision disagree.
  parameters: Record<string, string>;
  divergentParameters: string[];
}

// Confirmed COMED decisions (DocumentIA SUCCESS + decision_comed) of one Dahlia
// jurisdiction instance (TA069, TA069bis…, see data/jurisdiction-instance.ts),
// soft-deleted case files excluded. Read-only export run by a developer on the
// whole instance: no user scope applies here (standalone script in data/).
export function loadJurisdictionCaseFilesForComedExport(
  prisma: PrismaClient,
  jurisdictionShortName: string,
): Promise<CaseFileForComedExport[]> {
  return prisma.caseFile.findMany({
    where: { isDeleted: false, ...jurisdictionInstanceWhere(jurisdictionShortName) },
    select: CASE_FILE_EXPORT_SELECT,
    orderBy: { caseFileNumber: "asc" },
  });
}

export function loadComedInterpretations(
  prisma: PrismaClient,
  jurisdictionShortName: string,
): Promise<ComedInterpretation[]> {
  return prisma.attachedFileInterpretation.findMany({
    where: {
      status: "SUCCESS",
      documentType: { in: [...COMED_DOCUMENT_TYPES] },
      attachedFile: {
        caseFile: { isDeleted: false, ...jurisdictionInstanceWhere(jurisdictionShortName) },
      },
    },
    select: INTERPRETATION_SELECT,
    orderBy: [
      { attachedFile: { caseFileNumber: "asc" } },
      { attachedFile: { eventCreationDate: "asc" } },
    ],
  });
}

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function metadataOf(interpretation: ComedInterpretation): Record<string, string> {
  const raw = (interpretation.metadata ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, stringifyValue(value)]),
  );
}

function caseFileExportKey(jurisdictionCode: string, caseFileNumber: string): string {
  return `${jurisdictionCode}\u0000${caseFileNumber}`;
}

function emptyComedDecisionRow(caseFile: CaseFileForComedExport): ComedDecisionRow {
  return {
    jurisdictionCode: caseFile.jurisdictionCode,
    caseFileNumber: caseFile.caseFileNumber,
    claimant: caseFile.caseFileActors.find((link) => link.isMainClaimant)?.actor.displayName ?? "",
    defender: caseFile.caseFileActors.find((link) => link.isMainDefender)?.actor.displayName ?? "",
    caseFileName: caseFileName(caseFile),
    telerecoursTitle: caseFile.title ?? "",
    caseFileStatus: caseFile.lastStatus.label,
    detectedCount: 0,
    distinctCount: 0,
    pieceCount: 0,
    encodedFileIds: [],
    pieceNames: [],
    parameters: {},
    divergentParameters: [],
  };
}

// Same layout as getCaseFileDisplayName (app/lib/case-file-format.ts), built
// from the Postgres-computed actor displayName.
function caseFileName(caseFile: CaseFileForComedExport): string {
  const claimant = caseFile.caseFileActors.find((link) => link.isMainClaimant)?.actor.displayName;
  const defender = caseFile.caseFileActors.find((link) => link.isMainDefender)?.actor.displayName;
  const parts = [caseFile.caseFileNumber];
  if (claimant && defender) parts.push(`${claimant} c/ ${defender}`);
  else if (claimant || defender) parts.push((claimant || defender) as string);
  const litigation = litigationTypeShortLabel(caseFile.litigationType);
  const right = rightTypeLabel(caseFile.rightType);
  if (litigation) parts.push(litigation);
  if (right) parts.push(right);
  return parts.join(" - ");
}

export interface BuildComedDecisionRowsOptions {
  /** With --export-all: one placeholder row per dossier without any COMED decision. */
  allCaseFiles?: readonly CaseFileForComedExport[];
}

// Group interpretations by case file, then by decision pivot: one row per
// distinct decision. Pièces with an empty pivot are grouped together.
export function buildComedDecisionRows(
  interpretations: readonly ComedInterpretation[],
  options?: BuildComedDecisionRowsOptions,
): ComedDecisionRow[] {
  const byCaseFile = new Map<string, ComedInterpretation[]>();
  for (const interpretation of interpretations) {
    const { jurisdictionCode, caseFileNumber } = interpretation.attachedFile.caseFile;
    const key = `${jurisdictionCode}\u0000${caseFileNumber}`;
    byCaseFile.set(key, [...(byCaseFile.get(key) ?? []), interpretation]);
  }

  const rows: ComedDecisionRow[] = [];
  for (const group of byCaseFile.values()) {
    const caseFile = group[0].attachedFile.caseFile;
    const byDecision = new Map<
      string,
      { ids: string[]; names: string[]; metadata: Record<string, string>[] }
    >();
    for (const interpretation of group) {
      const metadata = metadataOf(interpretation);
      const pivot = COMED_DECISION_PIVOT.map((field) => metadata[field] ?? "").join("\u0000");
      const decision = byDecision.get(pivot) ?? { ids: [], names: [], metadata: [] };
      decision.ids.push(interpretation.encodedFileId);
      // Mirrors pieceDisplayLabel (app/lib/piece-display.ts, not importable under ts-node).
      decision.names.push(
        interpretation.attachedFile.dahliaName || interpretation.attachedFile.fileName,
      );
      decision.metadata.push(metadata);
      byDecision.set(pivot, decision);
    }

    for (const decision of byDecision.values()) {
      const keys = [...new Set(decision.metadata.flatMap((metadata) => Object.keys(metadata)))];
      const parameters: Record<string, string> = {};
      const divergentParameters: string[] = [];
      for (const key of keys) {
        const values = [...new Set(decision.metadata.map((metadata) => metadata[key] ?? ""))];
        const nonEmpty = values.filter((value) => value !== "");
        if (values.length > 1) divergentParameters.push(key);
        parameters[key] = nonEmpty.join(" | ");
      }
      rows.push({
        jurisdictionCode: caseFile.jurisdictionCode,
        caseFileNumber: caseFile.caseFileNumber,
        claimant:
          caseFile.caseFileActors.find((link) => link.isMainClaimant)?.actor.displayName ?? "",
        defender:
          caseFile.caseFileActors.find((link) => link.isMainDefender)?.actor.displayName ?? "",
        caseFileName: caseFileName(caseFile),
        telerecoursTitle: caseFile.title ?? "",
        caseFileStatus: caseFile.lastStatus.label,
        detectedCount: group.length,
        distinctCount: byDecision.size,
        pieceCount: decision.ids.length,
        encodedFileIds: decision.ids,
        pieceNames: decision.names,
        parameters,
        divergentParameters,
      });
    }
  }

  if (options?.allCaseFiles) {
    const covered = new Set(
      rows.map((row) => caseFileExportKey(row.jurisdictionCode, row.caseFileNumber)),
    );
    for (const caseFile of options.allCaseFiles) {
      const key = caseFileExportKey(caseFile.jurisdictionCode, caseFile.caseFileNumber);
      if (!covered.has(key)) rows.push(emptyComedDecisionRow(caseFile));
    }
    rows.sort((left, right) =>
      left.caseFileNumber.localeCompare(right.caseFileNumber, undefined, { numeric: true }),
    );
  }

  return rows;
}

// Parameter columns: required COMED fields first, then the others alphabetically.
function parameterColumns(rows: readonly ComedDecisionRow[]): string[] {
  const all = new Set(rows.flatMap((row) => Object.keys(row.parameters)));
  const required = REQUIRED_COMED_FIELDS.filter((field) => all.has(field));
  const others = [...all].filter((key) => !required.includes(key as never)).sort();
  return [...required, ...others];
}

function rowToSheetValues(
  row: ComedDecisionRow,
  parameterCols: readonly string[],
): (string | number)[] {
  return [
    row.jurisdictionCode,
    row.caseFileNumber,
    row.claimant,
    row.defender,
    row.caseFileName,
    row.telerecoursTitle,
    row.caseFileStatus,
    row.detectedCount,
    row.distinctCount,
    row.pieceCount,
    row.encodedFileIds.join(" "),
    row.pieceNames.join(" | "),
    row.divergentParameters.join(" "),
    ...parameterCols.map((column) => row.parameters[column] ?? ""),
  ];
}

// One row per distinct COMED decision (or per dossier with --export-all).
export function comedInterpretationSheetData(rows: readonly ComedDecisionRow[]): {
  headers: string[];
  data: (string | number)[][];
} {
  const parameterCols = parameterColumns(rows);
  const headers = [
    "TA",
    "caseFileNumber",
    "requerant",
    "defendeur",
    "nom_dossier",
    "nom_dossier_telerecours",
    "statut_dossier",
    "nb_decisions_comed_detectees",
    "nb_decisions_comed_distinctes",
    "nb_pieces_decision",
    "encodedFileIds",
    "nom_pieces",
    "parametres_divergents",
    ...parameterCols,
  ];
  return {
    headers,
    data: rows.map((row) => rowToSheetValues(row, parameterCols)),
  };
}

export async function writeComedInterpretationXlsx(
  rows: readonly ComedDecisionRow[],
): Promise<Buffer> {
  const { headers, data } = comedInterpretationSheetData(rows);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("COMED");
  worksheet.addRow(headers);
  worksheet.getRow(1).font = { bold: true };
  for (const values of data) worksheet.addRow(values);
  worksheet.columns.forEach((column) => {
    column.width = 30;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
