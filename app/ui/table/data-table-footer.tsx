"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type TableParamNames } from "@/app/lib/case-file-search";
import {
  type TablePageSize,
  type TablePageSizeId,
} from "@/app/lib/table-page-size";
import { TablePaginationFooter } from "@/app/ui/table-pagination-footer";
import { setTablePageSizeCookie } from "@/app/ui/use-table-page-size";

type Props = {
  params: TableParamNames;
  tableId: TablePageSizeId;
  currentPage: number;
  totalPages: number;
  pageSize: TablePageSize;
  // Extra query params preserved on pagination / page-size change (e.g. dashboard statut).
  preserveParams?: Record<string, string | undefined>;
};

export function DataTableFooter({
  params,
  tableId,
  currentPage,
  totalPages,
  pageSize,
  preserveParams,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  );
}
