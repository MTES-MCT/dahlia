import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const JURISDICTIONS_FACET_KEYS = ["code", "nom"] as const;

export type JurisdictionsFacetKey = (typeof JURISDICTIONS_FACET_KEYS)[number];

export const JURISDICTIONS_PARAMS: TableParamNames = {
  page: "page",
  sortBy: "sortBy",
  sortOrder: "sortOrder",
  query: "dahliaq",
};

export const JURISDICTIONS_DEFAULT_SORT_BY = "shortName";
export const JURISDICTIONS_DEFAULT_ORDER: SortOrder = "ascending";
