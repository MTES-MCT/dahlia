import { Prisma, type LegalEntityDivision } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { parseSearchQuery } from "@/app/lib/case-file-search";
import {
  DIVISIONS_DEFAULT_ORDER,
  DIVISIONS_DEFAULT_SORT_BY,
  DIVISIONS_FACET_KEYS,
  DIVISIONS_PARAMS,
  type DivisionsFacetKey,
} from "@/app/lib/divisions-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import {
  fetchPaginatedTableData,
  resolveTablePageSize,
  type PaginatedTableData,
} from "@/app/lib/fetch-paginated-table-data";
import { type SortOrder } from "@/app/lib/table-sort";
import { parseTableQueryState } from "@/app/lib/table-query-state";

export type DivisionListRow = Pick<LegalEntityDivision, "id" | "name" | "shortName">;

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

function buildDivisionsOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.LegalEntityDivisionOrderByWithRelationInput {
  switch (sortBy) {
    case "name":
      return { name: direction };
    case "shortName":
    default:
      return { shortName: direction };
  }
}

function textContainsFilter(field: "name" | "shortName", word: string) {
  return { [field]: { contains: word, mode: "insensitive" as const } };
}

function buildFreeTextFilter(freeText: string): Prisma.LegalEntityDivisionWhereInput {
  const words = facetSearchWords(freeText);
  return buildWordAndFilter(words, (word) => ({
    OR: [textContainsFilter("shortName", word), textContainsFilter("name", word)],
  }));
}

const FACET_BUILDERS: Record<
  DivisionsFacetKey,
  (rawValue: string) => Prisma.LegalEntityDivisionWhereInput
> = {
  code: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("shortName", word)),
  nom: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("name", word)),
};

function buildDivisionsWhere(query: string | null): Prisma.LegalEntityDivisionWhereInput {
  if (!query) return {};

  const conditions: Prisma.LegalEntityDivisionWhereInput[] = [];
  const { freeText, facets } = parseSearchQuery(query, DIVISIONS_FACET_KEYS);

  if (freeText) {
    conditions.push(buildFreeTextFilter(freeText));
  }

  for (const facet of facets) {
    conditions.push(FACET_BUILDERS[facet.key as DivisionsFacetKey](facet.value));
  }

  return combineAnd(conditions);
}

async function fetchDivisionsPage(
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<DivisionListRow[]> {
  return prisma.legalEntityDivision.findMany({
    where: buildDivisionsWhere(query),
    select: {
      id: true,
      name: true,
      shortName: true,
    },
    orderBy: buildDivisionsOrderBy(sortBy, toSortOrder(sortOrder)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function fetchDivisionsCount(query: string | null): Promise<number> {
  return prisma.legalEntityDivision.count({ where: buildDivisionsWhere(query) });
}

export type DivisionsTableData = PaginatedTableData<DivisionListRow>;

export async function fetchDivisionsTableData(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<DivisionsTableData> {
  const { page, sortBy, sortOrder, query } = parseTableQueryState(searchParams, DIVISIONS_PARAMS, {
    defaultSortBy: DIVISIONS_DEFAULT_SORT_BY,
    defaultOrder: DIVISIONS_DEFAULT_ORDER,
  });
  const pageSize = await resolveTablePageSize("divisions");

  return fetchPaginatedTableData({
    page,
    pageSize,
    fetchPage: () => fetchDivisionsPage(page, pageSize, sortBy, sortOrder, query),
    fetchCount: () => fetchDivisionsCount(query),
  });
}
