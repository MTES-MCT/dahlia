import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  normalizeForSearch,
  parseSearchQuery,
  FACET_KEYS,
  type FacetKey,
} from "@/app/lib/case-file-search";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";

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

const ACTOR_SORT_KEYS = ["mainClaimant", "mainDefender", "lastProducer"] as const;

export type CaseFilesTableData = {
  rows: CaseFileWithRelations[];
  totalPages: number;
  totalCount: number;
};

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

  return combineAnd(conditions);
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
      relatedSources: { include: { relatedCaseFile: true } },
      relatedTargets: { include: { caseFile: true } },
    },
  });
}

export type CaseFileDetail = Prisma.PromiseReturnType<typeof fetchCaseFileDetail>;

// Full case-file graph for the debug tab only (includes pièces).
export async function fetchCaseFileDebugSnapshot(caseFileNumber: string) {
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
      attachedFiles: { include: { fileFamilyType: true } },
      relatedSources: { include: { relatedCaseFile: true } },
      relatedTargets: { include: { caseFile: true } },
    },
  });
}

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
    rows: caseFiles,
    totalPages: Math.ceil(totalCount / numberOfCaseFiles),
    totalCount: totalCount,
  };
}
