import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import {
  normalizeForSearch,
  parseSearchQuery,
  FACET_KEYS,
  type FacetKey,
} from "@/app/lib/case-file-search";

// Re-exported so existing imports from this data module keep working; the actual
// implementations live in Prisma-free modules shared with client components.
export { formatDateFr, getActorDisplayName };
export { normalizeForSearch, parseSearchQuery, FACET_KEYS };
export type { ParsedSearch, FacetKey } from "@/app/lib/case-file-search";

type CaseFileWithRelations = Prisma.CaseFileGetPayload<{
  include: {
    mainClaimant: true;
    mainDefender: true;
    lastProducer: true;
    urgency: true;
    lastStatus: true;
    lastHearing: true;
  };
}>;

// The last element is the raw hearing convocation date (or null): the UI cell
// formats it and derives a status badge from it (see MemoryDeadlineCell).
export type CaseFileRow = [string, string, string, string, string, string, Date | null];

const ACTOR_SORT_KEYS = ["mainClaimant", "mainDefender", "lastProducer"] as const;

// Sort key for the memory-production deadline column: the convocation date of
// the last hearing. It lives on the `lastHearing` relation, so it needs a
// dedicated nested orderBy (see buildOrderBy).
export const HEARING_CONVOCATION_SORT_KEY = "convocationDate";

// Pour les acteurs, on trie sur la colonne calculée `displayName` (générée en
// base, cf. migration actor_display_name) qui reproduit getActorDisplayName.
function buildOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.CaseFileOrderByWithRelationInput {
  if ((ACTOR_SORT_KEYS as readonly string[]).includes(sortBy)) {
    return { [sortBy]: { displayName: { sort: direction, nulls: "last" } } };
  }
  if (sortBy === HEARING_CONVOCATION_SORT_KEY) {
    // `convocationDate` is a required field, so the `nulls` option is not allowed
    // here. Case files without a last hearing (null relation) are sorted NULLS
    // LAST by Postgres in ascending order — which is our default — so they end up
    // last as intended.
    return { lastHearing: { convocationDate: direction } };
  }
  return { [sortBy]: direction };
}

// Faceted-search builders: a facet `key:value` in the search box restricts the
// match to a single displayed column instead of the global OR. Keys map to the
// column names (normalized: lowercase + accents removed), so `requerant:`,
// `Requérant:` and `REQUERANT:` are all accepted. The value is matched
// case-insensitively and accent-insensitively (same rules as the free search).
// Multi-word values match when every word is found, in any order.
function facetSearchWords(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function buildWordAndFilter(
  words: string[],
  buildContains: (word: string) => Prisma.CaseFileWhereInput,
): Prisma.CaseFileWhereInput {
  if (words.length <= 1) {
    return buildContains(words[0] ?? "");
  }
  return { AND: words.map(buildContains) };
}

const FACET_BUILDERS: Record<
  FacetKey,
  (normalizedValue: string, rawValue: string) => Prisma.CaseFileWhereInput
> = {
  dossier: (_normalized, raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => ({
      caseFileNumber: { contains: word, mode: "insensitive" },
    })),
  requerant: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      mainClaimant: { displayNameNormalized: { contains: word } },
    })),
  defendeur: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      mainDefender: { displayNameNormalized: { contains: word } },
    })),
  producteur: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      lastProducer: { displayNameNormalized: { contains: word } },
    })),
  statut: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      lastStatus: { labelNormalized: { contains: word } } as unknown as Prisma.StatusWhereInput,
    })),
};

// Build the Prisma filter combining the search box (free text + facets) and the
// status label filter. All criteria are combined with AND; each criterion
// absent (null) is ignored.
function buildWhere(query: string | null, statusLabel: string | null): Prisma.CaseFileWhereInput {
  // Soft-deleted case files (absent from the latest Telerecours scrape within
  // their perimeter) are always hidden from the UI.
  const conditions: Prisma.CaseFileWhereInput[] = [
    { isDeleted: false } as Prisma.CaseFileWhereInput,
  ];

  if (query) {
    const { freeText, facets } = parseSearchQuery(query);

    // Free text: global OR across the case-file number and both actors.
    if (freeText) {
      const normalized = normalizeForSearch(freeText);
      conditions.push({
        OR: [
          { caseFileNumber: { contains: freeText, mode: "insensitive" } },
          { mainClaimant: { displayNameNormalized: { contains: normalized } } },
          { mainDefender: { displayNameNormalized: { contains: normalized } } },
          { lastProducer: { displayNameNormalized: { contains: normalized } } },
        ],
      });
    }

    // Facets: each one restricts a single column; combined with AND. `parseSearchQuery`
    // validated the key against FACET_KEYS here, so the cast to FacetKey is safe.
    for (const facet of facets) {
      conditions.push(
        FACET_BUILDERS[facet.key as FacetKey](normalizeForSearch(facet.value), facet.value),
      );
    }
  }

  if (statusLabel) {
    conditions.push({ lastStatus: { label: statusLabel } });
  }

  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

async function fetchCaseFiles(
  page: number,
  numberOfCaseFiles: number,
  sortBy: string | null,
  sortOrder: string | null = null,
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<CaseFileWithRelations[]> {
  const direction: Prisma.SortOrder = sortOrder === "ascending" ? "asc" : "desc";
  const where = buildWhere(query, statusLabel);
  return prisma.caseFile.findMany({
    include: {
      mainClaimant: true,
      mainDefender: true,
      lastProducer: true,
      urgency: true,
      lastStatus: true,
      lastHearing: true,
    },
    where,
    ...(sortBy ? { orderBy: buildOrderBy(sortBy, direction) } : {}),
    skip: (page - 1) * numberOfCaseFiles,
    take: numberOfCaseFiles,
  });
}

async function fetchCaseFilesCount(
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<number> {
  const where = buildWhere(query, statusLabel);
  return prisma.caseFile.count({ where });
}

// Status labels actually used by at least one case file — source of truth for the filter dropdown and server-side validation.
// Sometimes several `Status` lines share the same `label` (cf. Telerecours catalogue): we deduplicate on the label.
export async function fetchUsedStatusLabels(): Promise<string[]> {
  const statuses = await prisma.status.findMany({
    where: { caseFiles: { some: { isDeleted: false } as Prisma.CaseFileWhereInput } },
    select: { label: true },
    distinct: ["label"],
    orderBy: { label: "asc" },
  });
  return statuses.map((s) => s.label);
}

export function formatForTable(caseFiles: CaseFileWithRelations[]): CaseFileRow[] {
  return caseFiles.map((caseFile) => [
    caseFile.caseFileNumber,
    formatDateFr(caseFile.depositDate),
    getActorDisplayName(caseFile.mainClaimant),
    getActorDisplayName(caseFile.mainDefender),
    getActorDisplayName(caseFile.lastProducer),
    caseFile.lastStatus.label,
    caseFile.lastHearing?.convocationDate ?? null,
  ]);
}

export type CaseFilesTableData = {
  rows: CaseFileRow[];
  totalPages: number;
  totalCount: number;
};

// case-file detail with all its relations, for the detail page.
// Load the complete tree (actors, status, hearings → conclusions,
// events → measures/files, related case files) to display it in JSON.
export async function fetchCaseFileDetail(caseFileNumber: string) {
  return prisma.caseFile.findUnique({
    where: { caseFileNumber },
    include: {
      mainClaimant: true,
      mainDefender: true,
      urgency: true,
      lastStatus: true,
      chamber: true,
      assignedToLegalEntityDivision: true,
      lastHearing: { include: { lastConclusion: { include: { conclusionOperativePart: true } } } },
      hearings: { include: { lastConclusion: { include: { conclusionOperativePart: true } } } },
      events: {
        include: { measure: true, actor: true, attachedFiles: true },
        orderBy: { eventDate: "desc" },
      },
      attachedFiles: { include: { event: { include: { actor: true } } } },
      relatedSources: { include: { relatedCaseFile: true } },
      relatedTargets: { include: { caseFile: true } },
    },
  });
}

export type CaseFileDetail = Prisma.PromiseReturnType<typeof fetchCaseFileDetail>;

export async function fetchCaseFilesTableData(
  page: number,
  numberOfCaseFiles: number,
  sortBy: string | null,
  sortOrder: string,
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<CaseFilesTableData> {
  const [caseFiles, totalCount] = await Promise.all([
    fetchCaseFiles(page, numberOfCaseFiles, sortBy, sortOrder, query, statusLabel),
    fetchCaseFilesCount(query, statusLabel),
  ]);
  return {
    rows: formatForTable(caseFiles),
    totalPages: Math.ceil(totalCount / numberOfCaseFiles),
    totalCount: totalCount,
  };
}
