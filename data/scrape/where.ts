import type { Args } from "./pipeline";

// Statuses treated as closed. scrapedPerimeterWhere skips them when its
// caller passes excludeClosed (phases B/C unless --enrich all, phase A.5
// unless --all).
export const EXCLUDED_ENRICHMENT_STATUS_LABELS = ["Terminé"] as const;

// Dahlia jurisdiction instance this scrape runs against (TA069 vs TA069bis).
// Several instances can share one Télérecours court; without this clause a
// run soft-deletes or enriches the other instance's case files. Rows still
// at jurisdictionId null stay out of the perimeter until a scrape tags them.
function jurisdictionWhere(args: Args): { jurisdiction: { shortName: string } } {
  return { jurisdiction: { shortName: args.jurisdiction } };
}

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

// Case files inside the scraped perimeter: the scraped jurisdiction, the
// configured divisions when any, and not soft-deleted. When excludeClosed is
// true, dossiers whose status is "Terminé" are left out. Phases B and C pass
// `args.enrich !== "all"`; phase A.5 passes `!args.all`, because phase A only
// listed in-progress files unless --all.
export function scrapedPerimeterWhere(args: Args, excludeClosed: boolean) {
  return {
    ...(excludeClosed
      ? { lastStatus: { label: { notIn: [...EXCLUDED_ENRICHMENT_STATUS_LABELS] } } }
      : {}),
    ...divisionWhere(args),
    ...jurisdictionWhere(args),
    isDeleted: false,
  };
}
