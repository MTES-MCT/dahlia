"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { ColumnHeader } from "@/app/ui/column-header";
import { TableSearch } from "@/app/ui/table-search";
import { TablePaginationFooter } from "@/app/ui/table-pagination-footer";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { type TablePageSize, type TablePageSizeId } from "@/app/lib/table-page-size";
import { type TableColumn, type SortOrder, queryTableRows } from "@/app/lib/table-query";
import { useTablePageSize } from "@/app/ui/use-table-page-size";

// A column for a client-rendered table: the query behaviour (TableColumn) plus
// the display concerns (header label, sort capability, cell rendering).
export type ClientTableColumn<T> = TableColumn<T> & {
  label: string;
  // Whether the column header shows the sort control.
  sortable?: boolean;
  // Sort order applied when this column is the table default (no sort in URL).
  defaultOrder?: SortOrder;
  // Cell renderer; defaults to the column's `text` accessor.
  render?: (row: T) => React.ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: ClientTableColumn<T>[];
  // Prefixed URL param names isolating this table's state from the others.
  params: TableParamNames;
  tableId: TablePageSizeId;
  // Builds the table caption from the (filtered) total row count.
  caption: (totalCount: number) => string;
  // Sort applied when no `sortBy` is present in the URL.
  defaultSortBy: string;
  defaultOrder: SortOrder;
  searchLabel: string;
  searchPlaceholder?: string;
};

// Generic in-memory table: free-text + facet search, per-column sort/filter and
// pagination, all driven by prefixed URL params so several tables coexist on one
// page (the case-file detail tabs) and survive tab switches / refresh / sharing.
// It reuses the dashboard's `ColumnHeader` (sort + facet buttons) and the shared
// `queryTableRows` engine; only the data lives in memory instead of in Postgres.
export function ClientTable<T>({
  rows,
  columns,
  params,
  tableId,
  caption,
  defaultSortBy,
  defaultOrder,
  searchLabel,
  searchPlaceholder,
}: Props<T>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageSize, setPageSize } = useTablePageSize(tableId);
  const facetKeys = useMemo(
    () => columns.filter((column) => column.facet).map((column) => column.key),
    [columns],
  );

  const query = searchParams.get(params.query);
  const sortByParam = searchParams.get(params.sortBy);
  // No sort in the URL → fall back to the table default (e.g. date descending),
  // mirroring the dashboard's default-sort detection.
  const sortBy = sortByParam ?? defaultSortBy;
  const sortOrder: SortOrder = sortByParam
    ? ((searchParams.get(params.sortOrder) ?? "descending") as SortOrder)
    : defaultOrder;
  const page = Math.max(1, parseInt(searchParams.get(params.page) ?? "1", 10) || 1);

  const { pageRows, totalCount, totalPages, currentPage } = useMemo(
    () => queryTableRows(rows, columns, { query, sortBy, sortOrder, page, pageSize }),
    [rows, columns, query, sortBy, sortOrder, page, pageSize],
  );

  return (
    <>
      <TableSearch params={params} label={searchLabel} placeholder={searchPlaceholder} />

      <Table
        caption={caption(totalCount)}
        fixed
        headers={columns.map((column) => (
          <ColumnHeader
            key={column.key}
            label={column.label}
            sortKey={column.sortable ? column.key : undefined}
            defaultOrder={column.defaultOrder}
            facetKey={column.facet ? column.key : undefined}
            params={params}
            facetKeys={facetKeys}
          />
        ))}
        data={pageRows.map((row) =>
          columns.map((column) => (column.render ? column.render(row) : column.text(row))),
        )}
      />

      <TablePaginationFooter
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        getPageLinkProps={(pageNumber: number) => {
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set(params.page, String(pageNumber));
          return { href: `?${nextParams.toString()}`, scroll: false };
        }}
        onPageSizeChange={(nextPageSize: TablePageSize) => {
          setPageSize(nextPageSize);
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set(params.page, "1");
          router.push(`?${nextParams.toString()}`, { scroll: false });
        }}
      />
    </>
  );
}
