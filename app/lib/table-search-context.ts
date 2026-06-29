import { type TableParamNames } from "@/app/lib/case-file-search";

export type TableSearchHiddenParam = { name: string; value: string };

export type TableSearchContext = {
  action: string;
  currentQuery: string;
  hiddenParams: TableSearchHiddenParam[];
  resetHref: string;
};

type BuildTableSearchContextOptions = {
  // Param keys omitted from hidden fields (e.g. visible form controls on the dashboard).
  excludeFromHidden?: readonly string[];
};

// Build server-side search form context from URL search params: the current query
// string, hidden fields to preserve on submit (everything except this table's
// query/page and optional excludes), and a reset link that drops query + page only.
export function buildTableSearchContext(
  searchParams: Record<string, string | string[] | undefined>,
  params: TableParamNames,
  pathname: string,
  options?: BuildTableSearchContextOptions,
): TableSearchContext {
  const exclude = new Set<string>([
    params.query,
    params.page,
    ...(options?.excludeFromHidden ?? []),
  ]);

  const hiddenParams: TableSearchHiddenParam[] = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value !== "string" || exclude.has(key)) continue;
    hiddenParams.push({ name: key, value });
  }

  const queryParam = searchParams[params.query];
  const currentQuery = typeof queryParam === "string" ? queryParam : "";

  const resetParams = new URLSearchParams();
  for (const { name, value } of hiddenParams) {
    resetParams.set(name, value);
  }
  const queryString = resetParams.toString();
  const resetHref = queryString ? `${pathname}?${queryString}` : pathname;

  return { action: pathname, currentQuery, hiddenParams, resetHref };
}

// Mirror sort params as hidden fields on the dashboard search form so a text
// search keeps the current ordering without emitting defaults (page.tsx relies
// on absent sortBy to detect the default sort).
export function buildDashboardSortHiddenParams(
  sortByParam?: string,
  sortOrderParam?: string,
): TableSearchHiddenParam[] {
  const hidden: TableSearchHiddenParam[] = [];
  if (sortByParam) {
    hidden.push({ name: "sortBy", value: sortByParam });
  }
  if (sortByParam && sortOrderParam) {
    hidden.push({ name: "sortOrder", value: sortOrderParam });
  }
  return hidden;
}
