import type { LitigationType, Prisma, PrismaClient, RightType } from "@prisma/client";
import type { ClassificationChange } from "./classification-csv";
import { classify, hasClassification } from "./engine";
import { DEFAULT_RULES } from "./rules";
import type { ClassificationInput, ClassificationResult, ClassificationRule } from "./types";

// The classification-relevant state of a case file, as read from the database.
export interface CaseFileClassificationState {
  caseFileNumber: string;
  title: string | null;
  litigationType: LitigationType | null;
  rightType: RightType | null;
  summary: string | null;
  lastDecisionReading?: { nature: string | null; operativePart: string | null } | null;
}

export type CaseFileClassificationUpdate = {
  litigationType?: LitigationType;
  rightType?: RightType;
  summary?: string;
};

export interface ClassifyCaseFilesOptions {
  // Telerecours jurisdiction code (Jurisdiction.shortName, e.g. "TA069").
  jurisdiction?: string;
  // Same division filter as the scraper; empty/omitted means all divisions.
  legalEntityDivisionIds?: number[];
  // false (default): never touch a field that already has a value.
  // true: recompute and overwrite existing values.
  overwrite: boolean;
  // Compute and report, but write nothing.
  dryRun?: boolean;
  // Log one line per case file whose classification changed.
  verbose?: boolean;
  // Injectable so tests (and future variants) can run their own ruleset.
  rules?: readonly ClassificationRule[];
}

export interface UnmatchedCaseFile {
  caseFileNumber: string;
  title: string | null;
}

export interface ClassifyCaseFilesStats {
  scanned: number;
  // Case files for which the rules produced at least one attribute.
  matched: number;
  // Case files actually written (or that would be, in dry-run).
  updated: number;
  // Fields written, per attribute.
  fields: { litigationType: number; rightType: number; summary: number };
  // Every case file the rules said nothing about, with its title. Kept whole
  // for the CSV export; the console report only prints a sample of it.
  unmatched: UnmatchedCaseFile[];
  // Every case file written (or that would be, in dry-run), in scan order:
  // the reported lines, reusable for the CSV export.
  changes: ClassificationChange[];
}

const UNMATCHED_SAMPLE_SIZE = 20;

// Build the rule-engine input from a case file row. Today only `title` is
// filled by Telerecours; the last decision reading (nature + operative part) is
// exposed as the `decision` field so rules can already target it.
export function classificationInputOf(caseFile: CaseFileClassificationState): ClassificationInput {
  const decision = [
    caseFile.lastDecisionReading?.nature,
    caseFile.lastDecisionReading?.operativePart,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return { title: caseFile.title, decision: decision || null };
}

// Decide what to write for one case file: only attributes the rules produced,
// that differ from the stored value, and — unless `overwrite` — only where the
// stored value is still empty.
export function planCaseFileUpdate(
  current: CaseFileClassificationState,
  result: ClassificationResult,
  overwrite: boolean,
): CaseFileClassificationUpdate {
  const update: CaseFileClassificationUpdate = {};

  if (result.litigationType !== undefined && (overwrite || current.litigationType === null)) {
    if (result.litigationType !== current.litigationType)
      update.litigationType = result.litigationType;
  }
  if (result.rightType !== undefined && (overwrite || current.rightType === null)) {
    if (result.rightType !== current.rightType) update.rightType = result.rightType;
  }
  if (result.summary !== undefined && (overwrite || current.summary === null)) {
    if (result.summary !== current.summary) update.summary = result.summary;
  }

  return update;
}

function caseFilesWhere(options: ClassifyCaseFilesOptions): Prisma.CaseFileWhereInput {
  // A case file without a title carries no text to classify: skip it entirely
  // so it neither gets scanned nor pollutes the unmatched sample.
  const where: Prisma.CaseFileWhereInput = {
    isDeleted: false,
    AND: [{ title: { not: null } }, { title: { not: "" } }],
  };
  if (options.jurisdiction) {
    where.jurisdiction = { shortName: options.jurisdiction };
  }
  if (options.legalEntityDivisionIds && options.legalEntityDivisionIds.length > 0) {
    where.assignedToLegalEntityDivisionId = { in: options.legalEntityDivisionIds };
  }
  return where;
}

// Apply the rule engine to every case file of the perimeter and persist the
// deduced characteristics. Pure decisions live in `classify` and
// `planCaseFileUpdate`; this function only does I/O and reporting.
export async function classifyCaseFiles(
  prisma: PrismaClient,
  options: ClassifyCaseFilesOptions,
): Promise<ClassifyCaseFilesStats> {
  const rules = options.rules ?? DEFAULT_RULES;
  const caseFiles = await prisma.caseFile.findMany({
    where: caseFilesWhere(options),
    select: {
      caseFileNumber: true,
      title: true,
      litigationType: true,
      rightType: true,
      summary: true,
      lastDecisionReading: { select: { nature: true, operativePart: true } },
    },
    orderBy: { caseFileNumber: "asc" },
  });

  const stats: ClassifyCaseFilesStats = {
    scanned: caseFiles.length,
    matched: 0,
    updated: 0,
    fields: { litigationType: 0, rightType: 0, summary: 0 },
    unmatched: [],
    changes: [],
  };

  for (const caseFile of caseFiles) {
    const result = classify(classificationInputOf(caseFile), rules);

    if (!hasClassification(result)) {
      stats.unmatched.push({ caseFileNumber: caseFile.caseFileNumber, title: caseFile.title });
      continue;
    }
    stats.matched++;

    const update = planCaseFileUpdate(caseFile, result, options.overwrite);
    const changed = Object.keys(update) as (keyof CaseFileClassificationUpdate)[];
    if (changed.length === 0) continue;

    stats.updated++;
    for (const field of changed) stats.fields[field]++;
    const ruleIds = result.matches.map((match) => match.ruleId);
    stats.changes.push({
      caseFileNumber: caseFile.caseFileNumber,
      title: caseFile.title,
      update,
      ruleIds,
    });

    if (options.verbose || options.dryRun) {
      const changes = changed.map((field) => `${field}=${String(update[field])}`).join(", ");
      const title = caseFile.title ? `${caseFile.title}, ` : "";
      console.log(
        `  ${options.dryRun ? "[dry-run] " : ""}${caseFile.caseFileNumber}: ${title}${changes} (${ruleIds.join(" + ")})`,
      );
    }

    if (!options.dryRun) {
      await prisma.caseFile.update({
        where: { caseFileNumber: caseFile.caseFileNumber },
        data: update,
      });
    }
  }

  return stats;
}

export function logClassificationStats(stats: ClassifyCaseFilesStats, dryRun = false): void {
  if (stats.unmatched.length > 0) {
    console.log(
      `→ ${stats.unmatched.length} dossiers non reconnus, exemples (max ${UNMATCHED_SAMPLE_SIZE}) :`,
    );
    for (const { caseFileNumber, title } of stats.unmatched.slice(0, UNMATCHED_SAMPLE_SIZE)) {
      console.log(`  - ${caseFileNumber}: ${JSON.stringify(title)}`);
    }
  }
  console.log(
    `✓ Classification : ${stats.scanned} dossiers analysés, ${stats.matched} reconnus, ` +
      `${stats.updated} ${dryRun ? "à mettre à jour" : "mis à jour"} ` +
      `(litigationType: ${stats.fields.litigationType}, rightType: ${stats.fields.rightType}, ` +
      `summary: ${stats.fields.summary}).`,
  );
}
