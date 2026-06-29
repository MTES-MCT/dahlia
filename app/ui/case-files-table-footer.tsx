"use client";

import { useRouter } from "next/navigation";
import { type TablePageSize } from "@/app/lib/table-page-size";
import { TablePaginationFooter } from "@/app/ui/table-pagination-footer";
import { useTablePageSize } from "@/app/ui/use-table-page-size";

type Props = {
  currentPage: number;
  totalPages: number;
  sortBy: string;
  sortOrder: string;
  query: string | null;
  statutParam: string | undefined;
  defaultStatut: string;
};

function setStatutSearchParam(
  params: URLSearchParams,
  statutParam: string | undefined,
  defaultStatut: string,
) {
  if (statutParam === undefined) {
    params.set("statut", defaultStatut);
  } else {
    params.set("statut", statutParam);
  }
}

function buildPageHref(
  pageNumber: number,
  sortBy: string,
  sortOrder: string,
  query: string | null,
  statutParam: string | undefined,
  defaultStatut: string,
) {
  const params = new URLSearchParams({ page: String(pageNumber) });
  if (sortBy) params.set("sortBy", sortBy);
  if (sortOrder) params.set("sortOrder", sortOrder);
  if (query) params.set("dahliaq", query);
  setStatutSearchParam(params, statutParam, defaultStatut);
  return `/case_files?${params}`;
}

export function CaseFilesTableFooter({
  currentPage,
  totalPages,
  sortBy,
  sortOrder,
  query,
  statutParam,
  defaultStatut,
}: Props) {
  const router = useRouter();
  const { pageSize, setPageSize } = useTablePageSize("dashboard");

  function handlePageSizeChange(nextPageSize: TablePageSize) {
    setPageSize(nextPageSize);
    router.push(buildPageHref(1, sortBy, sortOrder, query, statutParam, defaultStatut));
  }

  return (
    <TablePaginationFooter
      pageSize={pageSize}
      onPageSizeChange={handlePageSizeChange}
      currentPage={currentPage}
      totalPages={totalPages}
      getPageLinkProps={(pageNumber) => ({
        href: buildPageHref(pageNumber, sortBy, sortOrder, query, statutParam, defaultStatut),
        scroll: false,
      })}
    />
  );
}
