"use client";

import { SortableColumnHeader } from "@/app/ui/sortable-column-header";
import { ColumnFilterButton } from "@/app/ui/column-filter-button";
import { type FacetKey } from "@/app/lib/case-file-search";

type Props = {
  label: string;
  // When set, the column is sortable (renders the sort button).
  sortKey?: string;
  // Default sort order applied when no `sortBy` is in the URL (sortable columns only).
  defaultOrder?: "ascending" | "descending";
  // When set, the column is filterable (renders the facet filter button).
  facetKey?: FacetKey;
};

// Table column header composing the optional sort control and the optional
// per-column facet filter, so `page.tsx` can declare each column's capabilities
// declaratively.
export function ColumnHeader({ label, sortKey, defaultOrder, facetKey }: Props) {
  return (
    <span style={{ display: "flex", alignItems: "center", width: "100%", gap: "0.25rem" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {sortKey ? (
          <SortableColumnHeader label={label} sortKey={sortKey} defaultOrder={defaultOrder} />
        ) : (
          label
        )}
      </span>
      {facetKey && <ColumnFilterButton facetKey={facetKey} label={label} />}
    </span>
  );
}
