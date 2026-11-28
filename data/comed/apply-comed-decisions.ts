import type { Prisma, PrismaClient } from "@prisma/client";
import { fieldChangeData, fieldChangeTargetCaseFile } from "../../app/lib/field-change";
import { COMED_DOCUMENT_TYPE } from "../document-ia/client";
import type { ComedJurisdictionFilter } from "./find-comed-decisions";

// `field_changes.origin` of the values copied from a DocumentIA COMED decision.
export const COMED_FIELD_CHANGE_ORIGIN = "document-ia";

// Same limit as the "Numéro ComDalo" input of the qualification block.
const COM_DALO_NUMBER_MAX_LENGTH = 64;

export interface ApplyComedOptions {
  filter: ComedJurisdictionFilter;
  // Compute and report, but write nothing.
  dryRun?: boolean;
  // false (default): only fill empty fields. true (--force-document-ia): also
  // replace a stored value that differs from the most recent decision.
  overwrite?: boolean;
  // Log one line per case file to update.
  verbose?: boolean;
}

export interface ApplyComedStats {
  // Case files with at least one confirmed COMED decision.
  caseFilesWithDecision: number;
  // Case files written (or that would be, in dry-run).
  caseFilesUpdated: number;
  fields: { comDaloNumber: number; comedDecisionDate: number };
  // Pièces typed DECISION_COMED, and pièces whose DECISION_COMED type was
  // withdrawn after a re-interpretation (or that would be, in dry-run).
  piecesTyped: number;
  piecesUntyped: number;
}

export function emptyApplyComedStats(): ApplyComedStats {
  return {
    caseFilesWithDecision: 0,
    caseFilesUpdated: 0,
    fields: { comDaloNumber: 0, comedDecisionDate: 0 },
    piecesTyped: 0,
    piecesUntyped: 0,
  };
}

// Add `part` into `total` (per-case-file reports of a run).
export function addApplyComedStats(total: ApplyComedStats, part: ApplyComedStats): void {
  total.caseFilesWithDecision += part.caseFilesWithDecision;
  total.caseFilesUpdated += part.caseFilesUpdated;
  total.fields.comDaloNumber += part.fields.comDaloNumber;
  total.fields.comedDecisionDate += part.fields.comedDecisionDate;
  total.piecesTyped += part.piecesTyped;
  total.piecesUntyped += part.piecesUntyped;
}

// One confirmed COMED decision of a case file.
export interface ComedDecisionValues {
  encodedFileId: string;
  eventCreationDate: Date;
  numeroRecours: string | null;
  dateDecision: Date | null;
}

export interface ComedCaseFileState {
  jurisdictionCode: string;
  caseFileNumber: string;
  comDaloNumber: string | null;
  comedDecisionDate: Date | null;
}

export type ComedCaseFileUpdate = { comDaloNumber?: string; comedDecisionDate?: Date };

// yyyy-mm-dd or dd/mm/yyyy, as a UTC midnight (the column is a @db.Date).
export function parseComedDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const parts = iso ? [iso[1], iso[2], iso[3]] : fr ? [fr[3], fr[2], fr[1]] : null;
  if (!parts) return null;
  const [year, month, day] = parts.map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseNumeroRecours(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  return raw && raw.length <= COM_DALO_NUMBER_MAX_LENGTH ? raw : null;
}

export function comedDecisionValuesOf(
  encodedFileId: string,
  eventCreationDate: Date,
  metadata: unknown,
): ComedDecisionValues {
  const values = (metadata ?? {}) as Record<string, unknown>;
  return {
    encodedFileId,
    eventCreationDate,
    numeroRecours: parseNumeroRecours(values.numero_recours),
    dateDecision: parseComedDate(values.date_decision),
  };
}

// Most recent decision: latest extracted decision date first (undated last),
// then latest pièce deposit date.
export function mostRecentComedDecision(
  decisions: readonly ComedDecisionValues[],
): ComedDecisionValues | null {
  const time = (date: Date | null) => date?.getTime() ?? Number.NEGATIVE_INFINITY;
  return decisions.reduce<ComedDecisionValues | null>((latest, decision) => {
    if (!latest) return decision;
    const byDecisionDate = time(decision.dateDecision) - time(latest.dateDecision);
    if (byDecisionDate !== 0) return byDecisionDate > 0 ? decision : latest;
    return decision.eventCreationDate > latest.eventCreationDate ? decision : latest;
  }, null);
}

// Both values come from the most recent decision. Without `overwrite`, only
// empty fields are filled: a value already stored (by an agent or a previous
// run) is kept. With it, a stored value that differs is replaced. A value the
// decision does not provide never clears the field.
export function planComedCaseFileUpdate(
  current: ComedCaseFileState,
  decision: ComedDecisionValues,
  overwrite = false,
): ComedCaseFileUpdate {
  const update: ComedCaseFileUpdate = {};
  if (
    decision.numeroRecours &&
    (overwrite || !current.comDaloNumber) &&
    decision.numeroRecours !== current.comDaloNumber
  ) {
    update.comDaloNumber = decision.numeroRecours;
  }
  if (
    decision.dateDecision &&
    (overwrite || !current.comedDecisionDate) &&
    decision.dateDecision.getTime() !== current.comedDecisionDate?.getTime()
  ) {
    update.comedDecisionDate = decision.dateDecision;
  }
  return update;
}

function formatDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// One history row per written field, so the qualification block asks an agent
// to review the values ("Qualification automatique à valider").
export function comedFieldChangesOf(
  current: ComedCaseFileState,
  update: ComedCaseFileUpdate,
): Prisma.FieldChangeCreateManyInput[] {
  const target = fieldChangeTargetCaseFile(current);
  const changes: Prisma.FieldChangeCreateManyInput[] = [];
  if (update.comDaloNumber !== undefined) {
    changes.push(
      fieldChangeData(target, {
        field: "comDaloNumber",
        previousValue: current.comDaloNumber || null,
        newValue: update.comDaloNumber,
        origin: COMED_FIELD_CHANGE_ORIGIN,
      }),
    );
  }
  if (update.comedDecisionDate !== undefined) {
    changes.push(
      fieldChangeData(target, {
        field: "comedDecisionDate",
        previousValue: current.comedDecisionDate
          ? formatDateValue(current.comedDecisionDate)
          : null,
        newValue: formatDateValue(update.comedDecisionDate),
        origin: COMED_FIELD_CHANGE_ORIGIN,
      }),
    );
  }
  return changes;
}

function caseFileKeyOf(jurisdictionCode: string, caseFileNumber: string): string {
  return `${jurisdictionCode}\0${caseFileNumber}`;
}

function scopeWhere(filter: ComedJurisdictionFilter) {
  return {
    ...(filter.jurisdictionCode ? { jurisdictionCode: filter.jurisdictionCode } : {}),
    ...(filter.caseFile ? { caseFile: filter.caseFile } : {}),
  };
}

const CONFIRMED_COMED: Prisma.AttachedFileInterpretationWhereInput = {
  status: "SUCCESS",
  documentType: COMED_DOCUMENT_TYPE,
};

// Interpreted by DocumentIA as something else than a COMED decision.
const NOT_COMED: Prisma.AttachedFileInterpretationWhereInput = {
  status: "SUCCESS",
  OR: [{ documentType: null }, { documentType: { not: COMED_DOCUMENT_TYPE } }],
};

// Copy the confirmed COMED decisions stored in attached_file_interpretations
// onto the data model: pièce `dahliaType`, and the case file's ComDalo number
// and COMED decision date taken from its most recent decision. Every confirmed
// decision of the perimeter is considered, not only those of the current run.
// Queries only filter on relations: selecting a relation binds one parameter
// per row, and the perimeter can exceed the Postgres limit (see
// find-comed-decisions).
export async function applyComedDecisions(
  prisma: PrismaClient,
  options: ApplyComedOptions,
): Promise<ApplyComedStats> {
  const scope = scopeWhere(options.filter);
  const dryRun = options.dryRun ?? false;
  const overwrite = options.overwrite ?? false;

  const [files, interpretations] = await Promise.all([
    prisma.attachedFile.findMany({
      where: { ...scope, interpretation: CONFIRMED_COMED },
      select: {
        jurisdictionCode: true,
        encodedFileId: true,
        caseFileNumber: true,
        eventCreationDate: true,
      },
    }),
    prisma.attachedFileInterpretation.findMany({
      where: { ...CONFIRMED_COMED, attachedFile: scope },
      select: { jurisdictionCode: true, encodedFileId: true, metadata: true },
    }),
  ]);

  const metadataByFile = new Map(
    interpretations.map((row) => [caseFileKeyOf(row.jurisdictionCode, row.encodedFileId), row]),
  );
  const decisionsByCaseFile = new Map<string, ComedDecisionValues[]>();
  for (const file of files) {
    const metadata = metadataByFile.get(caseFileKeyOf(file.jurisdictionCode, file.encodedFileId));
    const key = caseFileKeyOf(file.jurisdictionCode, file.caseFileNumber);
    const decisions = decisionsByCaseFile.get(key) ?? [];
    decisions.push(
      comedDecisionValuesOf(file.encodedFileId, file.eventCreationDate, metadata?.metadata),
    );
    decisionsByCaseFile.set(key, decisions);
  }

  const stats: ApplyComedStats = {
    caseFilesWithDecision: decisionsByCaseFile.size,
    caseFilesUpdated: 0,
    fields: { comDaloNumber: 0, comedDecisionDate: 0 },
    piecesTyped: 0,
    piecesUntyped: 0,
  };

  // ── Pièce type ──
  const toType: Prisma.AttachedFileWhereInput = {
    ...scope,
    interpretation: CONFIRMED_COMED,
    OR: [{ dahliaType: null }, { dahliaType: { not: "DECISION_COMED" } }],
  };
  const toUntype: Prisma.AttachedFileWhereInput = {
    ...scope,
    dahliaType: "DECISION_COMED",
    interpretation: NOT_COMED,
  };
  if (dryRun) {
    stats.piecesTyped = await prisma.attachedFile.count({ where: toType });
    stats.piecesUntyped = await prisma.attachedFile.count({ where: toUntype });
  } else {
    const now = new Date();
    stats.piecesTyped = (
      await prisma.attachedFile.updateMany({
        where: toType,
        data: { dahliaType: "DECISION_COMED", updatedAt: now },
      })
    ).count;
    stats.piecesUntyped = (
      await prisma.attachedFile.updateMany({
        where: toUntype,
        data: { dahliaType: null, updatedAt: now },
      })
    ).count;
  }

  // ── Case-file qualification (empty fields only) ──
  const caseFiles = await prisma.caseFile.findMany({
    where: {
      // Nested so the perimeter's own AND/OR are kept.
      AND: [
        options.filter.jurisdictionCode
          ? { jurisdictionCode: options.filter.jurisdictionCode }
          : {},
        options.filter.caseFile ?? {},
        { attachedFiles: { some: { interpretation: CONFIRMED_COMED } } },
        // Without overwrite, case files whose two fields are filled have nothing to change.
        overwrite
          ? {}
          : { OR: [{ comDaloNumber: null }, { comDaloNumber: "" }, { comedDecisionDate: null }] },
      ],
    },
    select: {
      jurisdictionCode: true,
      caseFileNumber: true,
      comDaloNumber: true,
      comedDecisionDate: true,
    },
    orderBy: [{ caseFileNumber: "asc" }, { jurisdictionCode: "asc" }],
  });

  for (const caseFile of caseFiles) {
    const decisions =
      decisionsByCaseFile.get(caseFileKeyOf(caseFile.jurisdictionCode, caseFile.caseFileNumber)) ??
      [];
    const decision = mostRecentComedDecision(decisions);
    if (!decision) continue;
    const update = planComedCaseFileUpdate(caseFile, decision, overwrite);
    if (Object.keys(update).length === 0) continue;

    stats.caseFilesUpdated++;
    if (update.comDaloNumber !== undefined) stats.fields.comDaloNumber++;
    if (update.comedDecisionDate !== undefined) stats.fields.comedDecisionDate++;

    if (options.verbose || dryRun) {
      const values = [
        update.comDaloNumber !== undefined ? `comDaloNumber=${update.comDaloNumber}` : null,
        update.comedDecisionDate !== undefined
          ? `comedDecisionDate=${formatDateValue(update.comedDecisionDate)}`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      const more = decisions.length > 1 ? ` (plus récente de ${decisions.length} décisions)` : "";
      console.log(
        `  ${dryRun ? "[dry-run] " : ""}${caseFile.jurisdictionCode} ${caseFile.caseFileNumber}: ${values}${more}`,
      );
    }

    if (!dryRun) {
      // The case file and its history are written together, or not at all.
      await prisma.$transaction([
        prisma.caseFile.update({
          where: {
            jurisdictionCode_caseFileNumber: {
              jurisdictionCode: caseFile.jurisdictionCode,
              caseFileNumber: caseFile.caseFileNumber,
            },
          },
          data: update,
        }),
        prisma.fieldChange.createMany({ data: comedFieldChangesOf(caseFile, update) }),
      ]);
    }
  }

  return stats;
}

export function logApplyComedStats(stats: ApplyComedStats, dryRun = false): void {
  const verb = dryRun ? "à mettre à jour" : "mis à jour";
  console.log("--------------------------------------------------");
  console.log(`REPORT DES DÉCISIONS COMED${dryRun ? " (dry-run, rien n'est écrit)" : ""}`);
  console.log(`  - dossiers avec une décision confirmée : ${stats.caseFilesWithDecision}`);
  console.log(
    `  - dossiers ${verb} : ${stats.caseFilesUpdated} ` +
      `(n° ComDalo : ${stats.fields.comDaloNumber}, date COMED : ${stats.fields.comedDecisionDate})`,
  );
  console.log(`  - pièces typées « décision COMED » : ${stats.piecesTyped}`);
  console.log(`  - pièces dont le type « décision COMED » est retiré : ${stats.piecesUntyped}`);
  console.log("--------------------------------------------------");
}
