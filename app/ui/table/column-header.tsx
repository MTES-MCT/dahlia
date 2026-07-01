"use client";

import { SortableColumnHeader } from "@/app/ui/table/sortable-column-header";
import { ColumnFilterButton } from "@/app/ui/button/column-filter-button";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

type Props = {
  label: string;
  // When set, the column is sortable (renders the sort button).
  sortKey?: string;
  // Default sort order applied when no `sortBy` is in the URL (sortable columns only).
  defaultOrder?: SortOrder;
  // When set, the column is filterable (renders the facet filter button).
  facetKey?: string;
  // URL param names backing this table's state (defaults to the dashboard's).
  params?: TableParamNames;
  // Facet keys recognized in this table's search grammar (defaults to FACET_KEYS).
  facetKeys?: readonly string[];
};

// Table column header composing the optional sort control and the optional
// per-column facet filter, so a page can declare each column's capabilities
// declaratively. `params`/`facetKeys` let a table scope its state to prefixed
// URL params and its own facet keys.
export function ColumnHeader({ label, sortKey, defaultOrder, facetKey, params, facetKeys }: Props) {
  return (
    <span style={{ display: "flex", alignItems: "center", width: "100%", gap: "0.25rem" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {sortKey ? (
          <SortableColumnHeader
            label={label}
            sortKey={sortKey}
            defaultOrder={defaultOrder}
            params={params}
          />
        ) : (
          label
        )}
      </span>
      {facetKey && (
        <ColumnFilterButton
          facetKey={facetKey}
          label={label}
          params={params}
          facetKeys={facetKeys}
        />
      )}
    </span>
  );
}
