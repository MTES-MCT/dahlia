"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import clsx from "clsx";
import { type TablePageSize } from "@/app/lib/table-page-size";
import { TablePageSizeSelect } from "@/app/ui/table/table-page-size-select";

type Props = {
  pageSize: TablePageSize;
  onPageSizeChange: (pageSize: TablePageSize) => void;
  currentPage: number;
  totalPages: number;
  getPageLinkProps: (pageNumber: number) => { href: string; scroll?: boolean };
  // Optional content pushed to the right edge of the footer (e.g. an export button).
  rightSlot?: React.ReactNode;
};

export function TablePaginationFooter({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  getPageLinkProps,
}: Props) {
  return (
    <div className={clsx("flex", "flex-wrap", "items-center", "gap-4")}>
      <div className={clsx("flex", "flex-wrap", "items-center", "gap-2")}>
        <TablePageSizeSelect
          pageSize={pageSize}
          onChange={onPageSizeChange}
          className={clsx(fr.cx("fr-mb-2w"))}
        />

        {totalPages > 1 && (
          <Pagination
            className={clsx(fr.cx("fr-mt-2w"))}
            count={totalPages}
            defaultPage={currentPage}
            getPageLinkProps={getPageLinkProps}
            showFirstLast={false}
          />
        )}
      </div>
    </div>
  );
}
