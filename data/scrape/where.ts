import type { Args } from "./pipeline";

// Statuses whose case files are never enriched (phase B/C) nor reconciled as
// active (phase A.5): they are considered closed.
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

// The set of "active" case files within the scraped perimeter: not closed
// ("Terminé"), within the configured divisions, and not soft-deleted. Used as
// the target set for enrichment (phase B), linking (phase C) and reconciliation
// (phase A.5).
export function enrichmentTargetsWhere(args: Args) {
  return {
    lastStatus: { label: { notIn: [...EXCLUDED_ENRICHMENT_STATUS_LABELS] } },
    ...divisionWhere(args),
    isDeleted: false,
  };
}
