import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const USERS_FACET_KEYS = ["nom", "prenom", "email"] as const;

export type UsersFacetKey = (typeof USERS_FACET_KEYS)[number];

export const USERS_PARAMS: TableParamNames = {
  page: "page",
  sortBy: "sortBy",
  sortOrder: "sortOrder",
  query: "dahliaq",
};

export const USERS_DEFAULT_SORT_BY = "lastName";
export const USERS_DEFAULT_ORDER: SortOrder = "ascending";
