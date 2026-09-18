import type { Args } from "./pipeline";

// Statuses treated as closed: skipped by default during enrichment (phase B/C)
// and reconciliation (phase A.5). --enrich all lifts the exclusion for phases
// B/C only.
export const EXCLUDED_ENRICHMENT_STATUS_LABELS = ["Terminé"] as const;

// Build a Prisma where-fragment for the division filter. When no division is
// configured (neither via CLI nor env), return an empty object so the clause is
// omitted entirely rather than degenerating into `{ in: [] }` (which would
// match nothing).
export function divisionWhere(args: Args): {
  assignedToLegalEntityDivisionId?: { in: number[] };
} {
  return args.legalEntityDivisionIds.length > 0
    ? { assignedToLegalEntityDivisionId: { in: args.legalEntityDivisionIds } }
    : {};
}

// The set of case files within the scraped perimeter used as the target for
// enrichment (phase B) and linking (phase C): within the configured divisions,
// not soft-deleted, and by default not closed ("Terminé"). Pass --enrich all
// to drop the status exclusion.
export function enrichmentTargetsWhere(args: Args) {
  return {
    ...(args.enrich === "all"
      ? {}
      : { lastStatus: { label: { notIn: [...EXCLUDED_ENRICHMENT_STATUS_LABELS] } } }),
    ...divisionWhere(args),
    isDeleted: false,
  };
}
