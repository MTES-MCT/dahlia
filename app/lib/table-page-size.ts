export const TABLE_PAGE_SIZES = [10, 30, 100] as const;

export type TablePageSize = (typeof TABLE_PAGE_SIZES)[number];

export const TABLE_PAGE_SIZE_IDS = {
  dashboard: "dashboard",
  pieces: "pieces",
  historique: "historique",
  users: "users",
} as const;

export type TablePageSizeId = (typeof TABLE_PAGE_SIZE_IDS)[keyof typeof TABLE_PAGE_SIZE_IDS];

export const DASHBOARD_PAGE_SIZE_COOKIE = "dahlia-table-page-size";

export function getTablePageSizeCookieName(id: TablePageSizeId): string {
  return `dahlia-table-page-size-${id}`;
}

export const DEFAULT_TABLE_PAGE_SIZES: Record<TablePageSizeId, TablePageSize> = {
  dashboard: 30,
  pieces: 10,
  historique: 10,
  users: 30,
};

export function getTablePageSizeStorageKey(id: TablePageSizeId): string {
  return `dahlia:tablePageSize:${id}`;
}

export function parseTablePageSize(
  value: string | null | undefined,
  defaultSize: TablePageSize,
): TablePageSize {
  const parsed = parseInt(value ?? "", 10);
  return TABLE_PAGE_SIZES.includes(parsed as TablePageSize)
    ? (parsed as TablePageSize)
    : defaultSize;
}
