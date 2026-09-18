import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const TAGS_FACET_KEYS = ["nom"] as const;

export type TagsFacetKey = (typeof TAGS_FACET_KEYS)[number];

export const TAGS_PARAMS: TableParamNames = {
  page: "page",
  sortBy: "sortBy",
  sortOrder: "sortOrder",
  query: "dahliaq",
};

export const TAGS_DEFAULT_SORT_BY = "label";
export const TAGS_DEFAULT_ORDER: SortOrder = "ascending";
