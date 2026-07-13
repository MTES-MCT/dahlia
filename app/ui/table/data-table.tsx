import { Table } from "@codegouvfr/react-dsfr/Table";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { type TableSearchHiddenParam } from "@/app/lib/table-search-context";
import { type SortOrder } from "@/app/lib/table-sort";
import { type TablePageSize, type TablePageSizeId } from "@/app/lib/table-page-size";
import { ColumnHeader } from "@/app/ui/table/column-header";
import { DataTableFooter } from "@/app/ui/table/data-table-footer";
import { TableSearchForm } from "@/app/ui/form/table-search-form";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultOrder?: SortOrder;
  facet?: boolean;
  // Search grammar facet key when it differs from `key` (e.g. dashboard `dossier`
  // column sorts on `caseFileNumber` but filters with `dossier:`).
  facetKey?: string;
  // Fixed column width (any CSS length, e.g. "9rem"). Columns without a width
  // share the remaining space equally (table-layout: fixed).
  width?: string;
  render: (row: T) => React.ReactNode;
};

export type DataTableSearchConfig = {
  action: string;
  currentQuery: string;
  hiddenParams: TableSearchHiddenParam[];
  resetHref: string;
  label: string;
  placeholder?: string;
  searchSlot?: React.ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: TablePageSize;
  params: TableParamNames;
  tableId: TablePageSizeId;
  facetKeys: readonly string[];
  caption: (totalCount: number) => string;
  search: DataTableSearchConfig;
  preserveParams?: Record<string, string | undefined>;
  // When set, a "download" button (flush right of the pagination) exports every
  // matching row to this route, preserving the current filter and sort.
  exportPath?: string;
  // When set, prepends an extra column (e.g. a selection checkbox) to the left
  // of the table, both in the header and in every row.
  leadingColumn?: {
    header: React.ReactNode;
    width?: string;
    render: (row: T) => React.ReactNode;
  };
};

// Unified server-rendered table: search bar, column headers (sort + facet),
// paginated rows and footer. Data is fetched in SQL by the page; URL params
// drive filter/sort/pagination on navigation (same model as the dashboard).
export function DataTable<T>({
  columns,
  rows,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  params,
  tableId,
  facetKeys,
  caption,
  search,
  preserveParams,
  exportPath,
  leadingColumn,
}: DataTableProps<T>) {
  const headers = [
    ...(leadingColumn ? [<span key="__leading">{leadingColumn.header}</span>] : []),
    ...columns.map((column) => (
      <ColumnHeader
        key={column.key}
        label={column.label}
        sortKey={column.sortable ? column.key : undefined}
        defaultOrder={column.defaultOrder}
        facetKey={column.facet ? (column.facetKey ?? column.key) : undefined}
        params={params}
        facetKeys={facetKeys}
      />
    )),
  ];

  // Per-column fixed widths applied via nth-child rules scoped to this table.
  // Under table-layout: fixed, sized columns keep their width and the rest split
  // the remaining space equally.
  const columnWidths = [
    ...(leadingColumn ? [leadingColumn.width] : []),
    ...columns.map((column) => column.width),
  ];
  const widthsClassName = `dt-widths-${tableId}`;
  const widthCss = columnWidths
    .map((width, index) =>
      width
        ? `.${widthsClassName} th:nth-child(${index + 1}),` +
          `.${widthsClassName} td:nth-child(${index + 1}){width:${width};}`
        : null,
    )
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <TableSearchForm params={params} {...search} />

      {widthCss && <style>{widthCss}</style>}
      <Table
        caption={caption(totalCount)}
        fixed
        headers={headers}
        data={rows.map((row) => [
          ...(leadingColumn ? [leadingColumn.render(row)] : []),
          ...columns.map((column) => column.render(row)),
        ])}
        className={clsx(fr.cx("fr-mb-2w"), widthCss && widthsClassName)}
      />

      <DataTableFooter
        params={params}
        tableId={tableId}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        preserveParams={preserveParams}
        exportPath={exportPath}
      />
    </>
  );
}
