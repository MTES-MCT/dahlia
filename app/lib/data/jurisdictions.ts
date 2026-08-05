import { Prisma, type Jurisdiction } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { parseSearchQuery } from "@/app/lib/case-file-search";
import {
  JURISDICTIONS_DEFAULT_ORDER,
  JURISDICTIONS_DEFAULT_SORT_BY,
  JURISDICTIONS_FACET_KEYS,
  JURISDICTIONS_PARAMS,
  type JurisdictionsFacetKey,
} from "@/app/lib/jurisdictions-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import {
  fetchPaginatedTableData,
  resolveTablePageSize,
  type PaginatedTableData,
} from "@/app/lib/fetch-paginated-table-data";
import { type SortOrder } from "@/app/lib/table-sort";
import { parseTableQueryState } from "@/app/lib/table-query-state";

export type JurisdictionListRow = Pick<Jurisdiction, "id" | "name" | "shortName">;

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

function buildJurisdictionsOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.JurisdictionOrderByWithRelationInput {
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

function buildFreeTextFilter(freeText: string): Prisma.JurisdictionWhereInput {
  const words = facetSearchWords(freeText);
  return buildWordAndFilter(words, (word) => ({
    OR: [textContainsFilter("shortName", word), textContainsFilter("name", word)],
  }));
}

const FACET_BUILDERS: Record<
  JurisdictionsFacetKey,
  (rawValue: string) => Prisma.JurisdictionWhereInput
> = {
  code: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("shortName", word)),
  nom: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("name", word)),
};

function buildJurisdictionsWhere(query: string | null): Prisma.JurisdictionWhereInput {
  if (!query) return {};

  const conditions: Prisma.JurisdictionWhereInput[] = [];
  const { freeText, facets } = parseSearchQuery(query, JURISDICTIONS_FACET_KEYS);

  if (freeText) {
    conditions.push(buildFreeTextFilter(freeText));
  }

  for (const facet of facets) {
    conditions.push(FACET_BUILDERS[facet.key as JurisdictionsFacetKey](facet.value));
  }

  return combineAnd(conditions);
}

async function fetchJurisdictionsPage(
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<JurisdictionListRow[]> {
  return prisma.jurisdiction.findMany({
    where: buildJurisdictionsWhere(query),
    select: {
      id: true,
      name: true,
      shortName: true,
    },
    orderBy: buildJurisdictionsOrderBy(sortBy, toSortOrder(sortOrder)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function fetchJurisdictionsCount(query: string | null): Promise<number> {
  return prisma.jurisdiction.count({ where: buildJurisdictionsWhere(query) });
}

// Full jurisdiction list (unpaginated), used to populate the user permission
// scope selector in the admin user forms.
export async function fetchJurisdictionOptions(): Promise<JurisdictionListRow[]> {
  return prisma.jurisdiction.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
    },
    orderBy: { shortName: "asc" },
  });
}

export type JurisdictionsTableData = PaginatedTableData<JurisdictionListRow>;

export async function fetchJurisdictionsTableData(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<JurisdictionsTableData> {
  const { page, sortBy, sortOrder, query } = parseTableQueryState(
    searchParams,
    JURISDICTIONS_PARAMS,
    {
      defaultSortBy: JURISDICTIONS_DEFAULT_SORT_BY,
      defaultOrder: JURISDICTIONS_DEFAULT_ORDER,
    },
  );
  const pageSize = await resolveTablePageSize("jurisdictions");

  return fetchPaginatedTableData({
    page,
    pageSize,
    fetchPage: () => fetchJurisdictionsPage(page, pageSize, sortBy, sortOrder, query),
    fetchCount: () => fetchJurisdictionsCount(query),
  });
}
