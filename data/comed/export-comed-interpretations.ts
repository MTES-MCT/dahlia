import type { Prisma, PrismaClient } from "@prisma/client";
import { litigationTypeShortLabel, rightTypeLabel } from "../../app/lib/case-file-enums";
import { COMED_DOCUMENT_TYPES } from "../document-ia/client";
import { jurisdictionInstanceWhere } from "../jurisdiction-instance";
import { REQUIRED_COMED_FIELDS } from "./interpret-comed-decisions";

// Pivot identifying a distinct COMED decision within a case file.
export const COMED_DECISION_PIVOT = ["numero_recours", "date_decision"] as const;

const INTERPRETATION_SELECT = {
  encodedFileId: true,
  metadata: true,
  attachedFile: {
    select: {
      eventCreationDate: true,
      fileName: true,
      dahliaName: true,
      caseFile: {
        select: {
          jurisdictionCode: true,
          caseFileNumber: true,
          title: true,
          litigationType: true,
          rightType: true,
          caseFileActors: {
            where: { OR: [{ isMainClaimant: true }, { isMainDefender: true }] },
            select: {
              isMainClaimant: true,
              isMainDefender: true,
              actor: { select: { displayName: true } },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.AttachedFileInterpretationSelect;

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

// Same layout as getCaseFileDisplayName (app/lib/case-file-format.ts), built
// from the Postgres-computed actor displayName.
function caseFileName(caseFile: ComedInterpretation["attachedFile"]["caseFile"]): string {
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

// Group interpretations by case file, then by decision pivot: one row per
// distinct decision. Pièces with an empty pivot are grouped together.
export function buildComedDecisionRows(
  interpretations: readonly ComedInterpretation[],
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
  return rows;
}

// Parameter columns: required COMED fields first, then the others alphabetically.
function parameterColumns(rows: readonly ComedDecisionRow[]): string[] {
  const all = new Set(rows.flatMap((row) => Object.keys(row.parameters)));
  const required = REQUIRED_COMED_FIELDS.filter((field) => all.has(field));
  const others = [...all].filter((key) => !required.includes(key as never)).sort();
  return [...required, ...others];
}

// RFC 4180 quoting.
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One line per distinct COMED decision. A leading BOM keeps accents readable in Excel.
export function toComedInterpretationCsv(rows: readonly ComedDecisionRow[]): string {
  const columns = parameterColumns(rows);
  const header = [
    "TA",
    "caseFileNumber",
    "requerant",
    "defendeur",
    "nom_dossier",
    "nom_dossier_telerecours",
    "nb_decisions_comed_detectees",
    "nb_decisions_comed_distinctes",
    "nb_pieces_decision",
    "encodedFileIds",
    "nom_pieces",
    "parametres_divergents",
    ...columns,
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.jurisdictionCode,
        row.caseFileNumber,
        row.claimant,
        row.defender,
        row.caseFileName,
        row.telerecoursTitle,
        row.detectedCount,
        row.distinctCount,
        row.pieceCount,
        row.encodedFileIds.join(" "),
        row.pieceNames.join(" | "),
        row.divergentParameters.join(" "),
        ...columns.map((column) => row.parameters[column] ?? ""),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `﻿${lines.join("\n")}\n`;
}
