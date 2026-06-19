// In-memory table query engine: free-text + facet filtering, sorting and
// pagination over an array already loaded in the browser. It mirrors the
// semantics of the server-side dashboard (`buildWhere`/`buildOrderBy` in
// `case-files.ts`) but runs client-side, so the case-file detail tables don't
// need a round-trip to filter their already-fetched relations. Prisma-free.

import { normalizeForSearch, parseSearchQuery } from "@/app/lib/case-file-search";

export type SortOrder = "ascending" | "descending";

// Declares how the engine reads a column. `key` is the identifier used both as
// the sort key (URL `sortBy`) and as the facet key in the search grammar.
export type TableColumn<T> = {
  key: string;
  // Text used by the free-text search and by this column's facet filter.
  text: (row: T) => string;
  // Comparable value used for sorting; null/undefined are always ordered last.
  sortValue?: (row: T) => string | number | Date | null | undefined;
  // Whether the free-text query searches this column.
  searchable?: boolean;
  // Whether `key:value` facets target this column.
  facet?: boolean;
};

export type TableQuery = {
  // Raw search string (free text + `key:value` facets), or null.
  query: string | null;
  sortBy: string | null;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
};

export type TableQueryResult<T> = {
  pageRows: T[];
  totalCount: number;
  totalPages: number;
  // Page clamped to the available range (e.g. when filtering shrinks the set).
  currentPage: number;
};

function compareSortValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
  direction: 1 | -1,
): number {
  // Nulls/undefined always sort last, regardless of the direction (so the
  // direction multiplier must not be applied to the empty-value branch).
  const aEmpty = a === null || a === undefined;
  const bEmpty = b === null || b === undefined;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (a < b) return -direction;
  if (a > b) return direction;
  return 0;
}

export function queryTableRows<T>(
  rows: T[],
  columns: TableColumn<T>[],
  { query, sortBy, sortOrder, page, pageSize }: TableQuery,
): TableQueryResult<T> {
  const columnsByKey = new Map(columns.map((column) => [column.key, column]));
  const facetKeys = columns.filter((column) => column.facet).map((column) => column.key);
  const searchableColumns = columns.filter((column) => column.searchable);

  let filtered = rows;

  if (query) {
    const { freeText, facets } = parseSearchQuery(query, facetKeys);

    // Free text: a row matches when the whole (normalized) text is a substring of
    // any searchable column — OR across columns, same as the dashboard.
    if (freeText) {
      const needle = normalizeForSearch(freeText);
      filtered = filtered.filter((row) =>
        searchableColumns.some((column) => normalizeForSearch(column.text(row)).includes(needle)),
      );
    }

    // Facets: each restricts a single column; multi-word values match when every
    // word is present (AND), in any order. Facets are combined with AND.
    for (const facet of facets) {
      const column = columnsByKey.get(facet.key);
      if (!column) continue;
      const words = normalizeForSearch(facet.value).split(/\s+/).filter(Boolean);
      filtered = filtered.filter((row) => {
        const haystack = normalizeForSearch(column.text(row));
        return words.every((word) => haystack.includes(word));
      });
    }
  }

  const totalCount = filtered.length;

  let sorted = filtered;
  const sortColumn = sortBy ? columnsByKey.get(sortBy) : undefined;
  if (sortColumn?.sortValue) {
    const direction = sortOrder === "ascending" ? 1 : -1;
    const getValue = sortColumn.sortValue;
    sorted = [...filtered].sort((a, b) => compareSortValues(getValue(a), getValue(b), direction));
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  return { pageRows, totalCount, totalPages, currentPage };
}
