// URL params and defaults for the pièces table (shared with the pièce edition page).

import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const PIECES_PARAMS: TableParamNames = {
  page: "pcPage",
  sortBy: "pcSort",
  sortOrder: "pcOrder",
  query: "pcq",
};

export const PIECES_FACET_KEYS = ["nom", "type"] as const;

export type PiecesFacetKey = (typeof PIECES_FACET_KEYS)[number];

export const PIECES_DEFAULT_SORT_BY = "date";
export const PIECES_DEFAULT_ORDER: SortOrder = "descending";
