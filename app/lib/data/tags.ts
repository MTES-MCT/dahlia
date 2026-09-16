import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { parseSearchQuery } from "@/app/lib/case-file-search";
import { CASE_FILE_ACTOR_INCLUDE } from "@/app/lib/case-file-actors";
import { getCaseFileDisplayName } from "@/app/lib/case-file-format";
import { caseFileScopeWhere } from "@/app/lib/case-file-scope";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import {
  TAGS_DEFAULT_ORDER,
  TAGS_DEFAULT_SORT_BY,
  TAGS_FACET_KEYS,
  TAGS_PARAMS,
  type TagsFacetKey,
} from "@/app/lib/tags-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import {
  fetchPaginatedTableData,
  resolveTablePageSize,
  type PaginatedTableData,
} from "@/app/lib/fetch-paginated-table-data";
import { type SortOrder } from "@/app/lib/table-sort";
import { parseTableQueryState } from "@/app/lib/table-query-state";

export type TagListRow = {
  id: number;
  label: string;
  color: string;
  // Number of case files carrying the tag: drives both the "Dossiers" column and
  // the choice between the delete-confirmation and the deletion-blocked modal.
  caseFileCount: number;
};

// A case file using a tag, reduced to what the deletion-blocked modal displays.
export type TagCaseFileRow = { caseFileNumber: string; displayName: string };

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

function buildTagsOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.TagOrderByWithRelationInput {
  switch (sortBy) {
    case "color":
      return { color: direction };
    case "caseFileCount":
      return { caseFileTags: { _count: direction } };
    case "label":
    default:
      return { label: direction };
  }
}

function labelContainsFilter(word: string): Prisma.TagWhereInput {
  return { label: { contains: word, mode: "insensitive" } };
}

const FACET_BUILDERS: Record<TagsFacetKey, (rawValue: string) => Prisma.TagWhereInput> = {
  nom: (raw) => buildWordAndFilter(facetSearchWords(raw), labelContainsFilter),
};

export function buildTagsWhere(query: string | null): Prisma.TagWhereInput {
  if (!query) return {};

  const conditions: Prisma.TagWhereInput[] = [];
  const { freeText, facets } = parseSearchQuery(query, TAGS_FACET_KEYS);

  if (freeText) {
    conditions.push(buildWordAndFilter(facetSearchWords(freeText), labelContainsFilter));
  }

  for (const facet of facets) {
    conditions.push(FACET_BUILDERS[facet.key as TagsFacetKey](facet.value));
  }

  return combineAnd(conditions);
}

const TAG_LIST_SELECT = {
  id: true,
  label: true,
  color: true,
  _count: { select: { caseFileTags: true } },
} satisfies Prisma.TagSelect;

async function fetchTagsPage(
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<TagListRow[]> {
  const tags = await prisma.tag.findMany({
    where: buildTagsWhere(query),
    select: TAG_LIST_SELECT,
    orderBy: buildTagsOrderBy(sortBy, toSortOrder(sortOrder)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return tags.map(({ _count, ...tag }) => ({ ...tag, caseFileCount: _count.caseFileTags }));
}

async function fetchTagsCount(query: string | null): Promise<number> {
  return prisma.tag.count({ where: buildTagsWhere(query) });
}

export type TagsTableData = PaginatedTableData<TagListRow>;

export async function fetchTagsTableData(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TagsTableData> {
  const { page, sortBy, sortOrder, query } = parseTableQueryState(searchParams, TAGS_PARAMS, {
    defaultSortBy: TAGS_DEFAULT_SORT_BY,
    defaultOrder: TAGS_DEFAULT_ORDER,
  });
  const pageSize = await resolveTablePageSize("tags");

  return fetchPaginatedTableData({
    page,
    pageSize,
    fetchPage: () => fetchTagsPage(page, pageSize, sortBy, sortOrder, query),
    fetchCount: () => fetchTagsCount(query),
  });
}

// Full tag catalogue (unpaginated), used to populate the picker in the case file
// details modal. Sorted in French locale order so accented labels fall in place.
export async function fetchTagOptions(): Promise<CaseFileTagView[]> {
  const tags = await prisma.tag.findMany({ select: { id: true, label: true, color: true } });
  return tags.sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

// Case files carrying a tag, for the deletion-blocked modal. Scoped like every
// other CaseFile read; for an administrator the fragment is a no-op.
export async function fetchTagCaseFiles(tagId: number, limit = 100): Promise<TagCaseFileRow[]> {
  const caseFiles = await prisma.caseFile.findMany({
    where: {
      isDeleted: false,
      caseFileTags: { some: { tagId } },
      ...(await caseFileScopeWhere()),
    },
    include: { caseFileActors: { include: CASE_FILE_ACTOR_INCLUDE } },
    orderBy: { caseFileNumber: "asc" },
    take: limit,
  });

  return caseFiles.map((caseFile) => ({
    caseFileNumber: caseFile.caseFileNumber,
    displayName: getCaseFileDisplayName(caseFile),
  }));
}
