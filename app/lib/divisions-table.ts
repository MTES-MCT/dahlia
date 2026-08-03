import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const DIVISIONS_FACET_KEYS = ["code", "nom"] as const;

export type DivisionsFacetKey = (typeof DIVISIONS_FACET_KEYS)[number];

export const DIVISIONS_PARAMS: TableParamNames = {
  page: "page",
  sortBy: "sortBy",
  sortOrder: "sortOrder",
  query: "dahliaq",
};

export const DIVISIONS_DEFAULT_SORT_BY = "shortName";
export const DIVISIONS_DEFAULT_ORDER: SortOrder = "ascending";
