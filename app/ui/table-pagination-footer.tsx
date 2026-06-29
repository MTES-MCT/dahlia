"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import { type TablePageSize } from "@/app/lib/table-page-size";
import { TablePageSizeSelect } from "@/app/ui/table-page-size-select";

type Props = {
  pageSize: TablePageSize;
  onPageSizeChange: (pageSize: TablePageSize) => void;
  currentPage: number;
  totalPages: number;
  getPageLinkProps: (pageNumber: number) => { href: string; scroll?: boolean };
};

export function TablePaginationFooter({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  getPageLinkProps,
}: Props) {
  return (
    <div
      className={fr.cx("fr-mt-2w")}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "1rem" }}
    >
      <TablePageSizeSelect pageSize={pageSize} onChange={onPageSizeChange} />

      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          defaultPage={currentPage}
          getPageLinkProps={getPageLinkProps}
          showFirstLast
        />
      )}
    </div>
  );
}
