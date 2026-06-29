import { cookies } from "next/headers";
import {
  DEFAULT_TABLE_PAGE_SIZES,
  getTablePageSizeCookieName,
  parseTablePageSize,
  type TablePageSize,
  type TablePageSizeId,
} from "@/app/lib/table-page-size";

export type PaginatedTableData<T> = {
  rows: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: TablePageSize;
};

export async function resolveTablePageSize(tableId: TablePageSizeId): Promise<TablePageSize> {
  const cookieStore = await cookies();
  return parseTablePageSize(
    cookieStore.get(getTablePageSizeCookieName(tableId))?.value,
    DEFAULT_TABLE_PAGE_SIZES[tableId],
  );
}

export async function fetchPaginatedTableData<T>(options: {
  page: number;
  pageSize: TablePageSize;
  fetchPage: () => Promise<T[]>;
  fetchCount: () => Promise<number>;
}): Promise<PaginatedTableData<T>> {
  const { page, pageSize, fetchPage, fetchCount } = options;
  const [rows, totalCount] = await Promise.all([fetchPage(), fetchCount()]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    rows,
    totalCount,
    totalPages,
    currentPage: Math.min(Math.max(1, page), totalPages),
    pageSize,
  };
}
