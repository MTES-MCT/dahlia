import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { type StatusGroup } from "@/app/lib/dashboard-filter";

// Dashboard searches saved by a user (« Mes recherches »). Shared between the
// data layer, the Server Actions and the dashboard UI.

export const SAVED_SEARCH_NAME_MAX_LENGTH = 60;

export type SavedSearchView = {
  id: number;
  name: string;
  // Raw `dahliaq` search (free text + facets).
  query: string;
  statusGroup: StatusGroup;
};

// Current dashboard ordering, carried over when switching searches.
export type DashboardSortParams = { sortBy?: string; sortOrder?: string };

const DASHBOARD_PATH = "/case_files";

// Dashboard URL running `query` in the `group` tab, first page, keeping the
// current ordering. An empty query clears the search.
export function dashboardSearchHref(
  query: string,
  group: StatusGroup,
  sort: DashboardSortParams = {},
): string {
  const params = new URLSearchParams();
  if (sort.sortBy) params.set("sortBy", sort.sortBy);
  if (sort.sortBy && sort.sortOrder) params.set("sortOrder", sort.sortOrder);
  if (query) params.set(DASHBOARD_TABLE_PARAMS.query, query);
  params.set("groupe", group);
  return `${DASHBOARD_PATH}?${params.toString()}`;
}

// Saved search matching the search currently displayed (same query, same tab),
// if any.
export function findCurrentSavedSearch(
  searches: readonly SavedSearchView[],
  query: string,
  group: StatusGroup,
): SavedSearchView | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;
  return searches.find((search) => search.query === trimmed && search.statusGroup === group);
}
