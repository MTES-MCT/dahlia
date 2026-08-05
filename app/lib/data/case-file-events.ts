import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { caseFileRelationScopeWhere } from "@/app/lib/case-file-scope";
import { normalizeForSearch, parseSearchQuery } from "@/app/lib/case-file-search";
import {
  HISTORIQUE_DEFAULT_ORDER,
  HISTORIQUE_DEFAULT_SORT_BY,
  HISTORIQUE_FACET_KEYS,
  HISTORIQUE_PARAMS,
  type HistoriqueFacetKey,
} from "@/app/lib/historique-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import {
  fetchPaginatedTableData,
  resolveTablePageSize,
  type PaginatedTableData,
} from "@/app/lib/fetch-paginated-table-data";
import { type SortOrder } from "@/app/lib/table-sort";
import { parseTableQueryState } from "@/app/lib/table-query-state";

const EVENT_LIST_INCLUDE = {
  measure: true,
  actor: true,
} satisfies Prisma.CaseFileEventInclude;

type CaseFileEventRow = Prisma.CaseFileEventGetPayload<{ include: typeof EVENT_LIST_INCLUDE }>;

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

function buildEventsOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.CaseFileEventOrderByWithRelationInput {
  switch (sortBy) {
    case "evenement":
      return { measure: { label: direction } };
    case "producteur":
      return { actor: { displayName: { sort: direction, nulls: "last" } } };
    case "commentaire":
      return { comment: { sort: direction, nulls: "last" } };
    case "echeance":
      return { deadlineLabel: { sort: direction, nulls: "last" } };
    case "date":
    default:
      return { eventDate: direction };
  }
}

function buildEventsWhere(
  caseFileNumber: string,
  query: string | null,
): Prisma.CaseFileEventWhereInput {
  const conditions: Prisma.CaseFileEventWhereInput[] = [{ caseFileNumber }];

  if (query) {
    const { freeText, facets } = parseSearchQuery(query, HISTORIQUE_FACET_KEYS);

    if (freeText) {
      const normalized = normalizeForSearch(freeText);
      conditions.push({
        OR: [
          { measure: { labelNormalized: { contains: normalized } } },
          { actor: { displayNameNormalized: { contains: normalized } } },
          { commentSearchNormalized: { contains: normalized } },
        ],
      });
    }

    for (const facet of facets) {
      const normalizedValue = normalizeForSearch(facet.value);
      const words = facetSearchWords(normalizedValue);

      switch (facet.key as HistoriqueFacetKey) {
        case "evenement":
          conditions.push(
            buildWordAndFilter(words, (word) => ({
              measure: { labelNormalized: { contains: word } },
            })),
          );
          break;
        case "producteur":
          conditions.push(
            buildWordAndFilter(words, (word) => ({
              actor: { displayNameNormalized: { contains: word } },
            })),
          );
          break;
        case "commentaire":
          conditions.push(
            buildWordAndFilter(words, (word) => ({
              commentSearchNormalized: { contains: word },
            })),
          );
          break;
        case "echeance":
          conditions.push(
            buildWordAndFilter(words, (word) => ({
              deadlineLabelSearchNormalized: { contains: word },
            })),
          );
          break;
      }
    }
  }

  return combineAnd(conditions);
}

// Search filter narrowed to the current user's permission scope, shared by the
// page query and its count.
async function buildScopedEventsWhere(
  caseFileNumber: string,
  query: string | null,
): Promise<Prisma.CaseFileEventWhereInput> {
  return { ...buildEventsWhere(caseFileNumber, query), ...(await caseFileRelationScopeWhere()) };
}

export type CaseFileEventListRow = CaseFileEventRow;

export type CaseFileEventsTableData = PaginatedTableData<CaseFileEventRow>;

async function fetchCaseFileEventsPage(
  caseFileNumber: string,
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<CaseFileEventRow[]> {
  return prisma.caseFileEvent.findMany({
    where: await buildScopedEventsWhere(caseFileNumber, query),
    include: EVENT_LIST_INCLUDE,
    orderBy: buildEventsOrderBy(sortBy, toSortOrder(sortOrder)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function fetchCaseFileEventsCount(
  caseFileNumber: string,
  query: string | null,
): Promise<number> {
  return prisma.caseFileEvent.count({ where: await buildScopedEventsWhere(caseFileNumber, query) });
}

export async function fetchCaseFileEventsTableData(
  caseFileNumber: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<CaseFileEventsTableData> {
  const { page, sortBy, sortOrder, query } = parseTableQueryState(searchParams, HISTORIQUE_PARAMS, {
    defaultSortBy: HISTORIQUE_DEFAULT_SORT_BY,
    defaultOrder: HISTORIQUE_DEFAULT_ORDER,
  });
  const pageSize = await resolveTablePageSize("historique");

  return fetchPaginatedTableData({
    page,
    pageSize,
    fetchPage: () =>
      fetchCaseFileEventsPage(caseFileNumber, page, pageSize, sortBy, sortOrder, query),
    fetchCount: () => fetchCaseFileEventsCount(caseFileNumber, query),
  });
}
