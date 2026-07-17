import { Prisma } from "@prisma/client";
import {
  CASE_FILE_ACTOR_INCLUDE,
  buildMainActorSearchFilter,
} from "@/app/lib/case-file-actors";
import {
  CASE_FILES_DASHBOARD_INCLUDE,
  HEARING_CONVOCATION_SORT_KEY,
  type CaseFileDashboardRow,
} from "@/app/lib/case-files-dashboard-columns";
import { prisma } from "@/app/lib/prisma";
import { normalizeForSearch, parseSearchQuery, type FacetKey } from "@/app/lib/case-file-search";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";

export { HEARING_CONVOCATION_SORT_KEY } from "@/app/lib/case-files-dashboard-columns";

type CaseFileWithRelations = CaseFileDashboardRow;

// Main actor columns are filterable but not sortable (Prisma cannot orderBy a filtered 1-N link).
const UNSORTABLE_KEYS = ["mainClaimant", "mainDefender"] as const;

export type CaseFilesTableData = {
  rows: CaseFileWithRelations[];
  totalPages: number;
  totalCount: number;
};

function buildOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.CaseFileOrderByWithRelationInput | undefined {
  if ((UNSORTABLE_KEYS as readonly string[]).includes(sortBy)) {
    return undefined;
  }
  if (sortBy === "lastProducer") {
    return { lastProducer: { displayName: { sort: direction, nulls: "last" } } };
  }
  if (sortBy === HEARING_CONVOCATION_SORT_KEY) {
    return { memoryDeadlineDate: { sort: direction, nulls: "last" } };
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
    buildWordAndFilter(facetSearchWords(normalized), (word) =>
      buildMainActorSearchFilter("isMainClaimant", word),
    ),
  defendeur: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) =>
      buildMainActorSearchFilter("isMainDefender", word),
    ),
  producteur: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      lastProducer: { displayNameNormalized: { contains: word } },
    })),
  statut: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      lastStatus: { labelNormalized: { contains: word } } as unknown as Prisma.StatusWhereInput,
    })),
};

function buildWhere(query: string | null, statusLabel: string | null): Prisma.CaseFileWhereInput {
  const conditions: Prisma.CaseFileWhereInput[] = [
    { isDeleted: false } as Prisma.CaseFileWhereInput,
  ];

  if (query) {
    const { freeText, facets } = parseSearchQuery(query);

    if (freeText) {
      const normalized = normalizeForSearch(freeText);
      conditions.push({
        OR: [
          { caseFileNumber: { contains: freeText, mode: "insensitive" } },
          buildMainActorSearchFilter("isMainClaimant", normalized),
          buildMainActorSearchFilter("isMainDefender", normalized),
          { lastProducer: { displayNameNormalized: { contains: normalized } } },
        ],
      });
    }

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
  const orderBy = sortBy ? buildOrderBy(sortBy, direction) : undefined;

  return prisma.caseFile.findMany({
    include: CASE_FILES_DASHBOARD_INCLUDE,
    where,
    ...(orderBy ? { orderBy } : {}),
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

const CASE_FILE_DETAIL_INCLUDE = {
  caseFileActors: { include: CASE_FILE_ACTOR_INCLUDE },
  actorRepresentations: {
    include: {
      representedActor: true,
      representativeActor: true,
    },
  },
  urgency: true,
  lastStatus: true,
  chamber: true,
  assignedToLegalEntityDivision: true,
  lastDecisionReading: true,
  lastHearing: { include: { lastConclusion: { include: { conclusionOperativePart: true } } } },
  hearings: { include: { lastConclusion: { include: { conclusionOperativePart: true } } } },
  events: {
    include: { measure: true, actor: true, attachedFiles: true },
    orderBy: { eventDate: "desc" as const },
  },
  relatedSources: { include: { relatedCaseFile: true } },
  relatedTargets: { include: { caseFile: true } },
} satisfies Prisma.CaseFileInclude;

export async function fetchCaseFileDetail(caseFileNumber: string) {
  return prisma.caseFile.findUnique({
    where: { caseFileNumber },
    include: CASE_FILE_DETAIL_INCLUDE,
  });
}

export type CaseFileDetail = Prisma.PromiseReturnType<typeof fetchCaseFileDetail>;

export async function fetchCaseFileDebugSnapshot(caseFileNumber: string) {
  return prisma.caseFile.findUnique({
    where: { caseFileNumber },
    include: {
      ...CASE_FILE_DETAIL_INCLUDE,
      attachedFiles: { include: { fileFamilyType: true } },
    },
  });
}

export async function fetchAllCaseFilesForExport(
  sortBy: string | null,
  sortOrder: string,
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<CaseFileWithRelations[]> {
  const direction: Prisma.SortOrder = sortOrder === "ascending" ? "asc" : "desc";
  const where = buildWhere(query, statusLabel);
  const orderBy = sortBy ? buildOrderBy(sortBy, direction) : undefined;

  return prisma.caseFile.findMany({
    include: CASE_FILES_DASHBOARD_INCLUDE,
    where,
    ...(orderBy ? { orderBy } : {}),
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
