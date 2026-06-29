import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export type TableQueryState = {
  query: string | null;
  sortBy: string;
  sortOrder: SortOrder;
  page: number;
};

export function parseTableQueryState(
  searchParams: Record<string, string | string[] | undefined>,
  params: TableParamNames,
  defaults: { defaultSortBy: string; defaultOrder: SortOrder },
): TableQueryState {
  const get = (key: string): string | undefined => {
    const value = searchParams[key];
    return typeof value === "string" ? value : undefined;
  };

  const sortByParam = get(params.sortBy);
  const sortBy = sortByParam ?? defaults.defaultSortBy;
  const sortOrder: SortOrder = sortByParam
    ? ((get(params.sortOrder) ?? "descending") as SortOrder)
    : defaults.defaultOrder;
  const page = Math.max(1, parseInt(get(params.page) ?? "1", 10) || 1);
  const query = get(params.query)?.trim() || null;

  return { query, sortBy, sortOrder, page };
}
