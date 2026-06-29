import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const HISTORIQUE_FACET_KEYS = [
  "evenement",
  "producteur",
  "commentaire",
  "echeance",
] as const;

export type HistoriqueFacetKey = (typeof HISTORIQUE_FACET_KEYS)[number];

export const HISTORIQUE_PARAMS: TableParamNames = {
  page: "hiPage",
  sortBy: "hiSort",
  sortOrder: "hiOrder",
  query: "hiq",
};

export const HISTORIQUE_DEFAULT_SORT_BY = "date";
export const HISTORIQUE_DEFAULT_ORDER: SortOrder = "descending";
