"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { type TablePageSize, type TablePageSizeId } from "@/app/lib/table-page-size";
import { DownloadButton } from "@/app/ui/button/download-button";
import { TablePaginationFooter } from "@/app/ui/table/table-pagination-footer";
import { setTablePageSizeCookie } from "@/app/ui/table/use-table-page-size";

type Props = {
  params: TableParamNames;
  tableId: TablePageSizeId;
  currentPage: number;
  totalPages: number;
  pageSize: TablePageSize;
  // Extra query params preserved on pagination / page-size change (e.g. dashboard statut).
  preserveParams?: Record<string, string | undefined>;
  // When set, a "download" button is shown flush to the right of the pagination,
  // linking to this route with the current filter/sort (minus pagination) so the
  // export mirrors the visible filter but contains every matching row.
  exportPath?: string;
};

export function DataTableFooter({
  params,
  tableId,
  currentPage,
  totalPages,
  pageSize,
  preserveParams,
  exportPath,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildExportHref(): string {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(params.page);
    if (preserveParams) {
      for (const [key, value] of Object.entries(preserveParams)) {
        if (value !== undefined) nextParams.set(key, value);
      }
    }
    const queryString = nextParams.toString();
    return queryString ? `${exportPath}?${queryString}` : (exportPath ?? "");
  }

  function buildHref(pageNumber: number): string {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(params.page, String(pageNumber));
    if (preserveParams) {
      for (const [key, value] of Object.entries(preserveParams)) {
        if (value !== undefined) nextParams.set(key, value);
      }
    }
    const queryString = nextParams.toString();
    return queryString ? `?${queryString}` : "?";
  }

  function handlePageSizeChange(nextPageSize: TablePageSize) {
    setTablePageSizeCookie(tableId, nextPageSize);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(params.page, "1");
    if (preserveParams) {
      for (const [key, value] of Object.entries(preserveParams)) {
        if (value !== undefined) nextParams.set(key, value);
      }
    }
    router.push(`?${nextParams.toString()}`, { scroll: false });
    router.refresh();
  }

  return (
    <>
      <TablePaginationFooter
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        getPageLinkProps={(pageNumber) => ({
          href: buildHref(pageNumber),
          scroll: false,
        })}
        onPageSizeChange={handlePageSizeChange}
      />
      {exportPath && <DownloadButton href={buildExportHref()} />}
    </>
  );
}
