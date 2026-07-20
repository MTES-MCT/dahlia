import { type TableParamNames } from "@/app/lib/case-file-search";
import { type TableSearchHiddenParam } from "@/app/lib/table-search-context";
import { type SortOrder } from "@/app/lib/table-sort";
import { type TablePageSize, type TablePageSizeId } from "@/app/lib/table-page-size";
import { ColumnHeader } from "@/app/ui/table/column-header";
import { type FacetField } from "@/app/ui/button/column-filter-button";
import { DataTableFooter } from "@/app/ui/table/data-table-footer";
import { TableSearchForm } from "@/app/ui/form/table-search-form";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultOrder?: SortOrder;
  // When set, the column header renders a facet filter popover for these fields.
  facetFields?: readonly FacetField[];
  // Column width (any CSS length, e.g. "9rem"), applied via `<col>`.
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
  // Minimum table width (any CSS length, e.g. "50rem"), applied via injected CSS.
  minWidth?: string;
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
  minWidth,
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
        facetFields={column.facetFields}
        params={params}
        facetKeys={facetKeys}
      />
    )),
  ];

  const tableRows = rows.map((row) => [
    ...(leadingColumn ? [leadingColumn.render(row)] : []),
    ...columns.map((column) => column.render(row)),
  ]);

  const columnWidths = [
    ...(leadingColumn ? [leadingColumn.width] : []),
    ...columns.map((column) => column.width),
  ];
  const sizingClassName = `dt-sizing-${tableId}`;
  const columnRules = columnWidths
    .map((width, index) => {
      if (!width) return null;
      return `  .${sizingClassName} col:nth-child(${index + 1}){width:${width};}`;
    })
    .filter(Boolean)
    .join("\n");
  const sizingCss = `.${sizingClassName} table {
  table-layout: fixed;
  width: 100%;
  ${minWidth ? `\n  min-width: ${minWidth};` : ""}
}${columnRules ? `\n${columnRules}` : ""}`;

  return (
    <>
      <TableSearchForm params={params} {...search} />

      <style>{sizingCss}</style>
      <div
        className={clsx(fr.cx("fr-table", "fr-table--layout-fixed", "fr-mb-2w"), sizingClassName)}
      >
        <table>
          <colgroup>
            {columnWidths.map((_, index) => (
              <col key={index} />
            ))}
          </colgroup>
          <caption>{caption(totalCount)}</caption>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
