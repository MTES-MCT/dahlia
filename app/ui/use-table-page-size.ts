"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type TablePageSize,
  type TablePageSizeId,
  DEFAULT_TABLE_PAGE_SIZES,
  DASHBOARD_PAGE_SIZE_COOKIE,
  getTablePageSizeCookieName,
  getTablePageSizeStorageKey,
  parseTablePageSize,
} from "@/app/lib/table-page-size";

function readStoredPageSize(tableId: TablePageSizeId): TablePageSize {
  if (typeof window === "undefined") {
    return DEFAULT_TABLE_PAGE_SIZES[tableId];
  }

  return parseTablePageSize(
    localStorage.getItem(getTablePageSizeStorageKey(tableId)),
    DEFAULT_TABLE_PAGE_SIZES[tableId],
  );
}

function readPageSizeCookie(tableId: TablePageSizeId): TablePageSize | null {
  if (typeof document === "undefined") return null;

  const cookieName =
    tableId === "dashboard" ? DASHBOARD_PAGE_SIZE_COOKIE : getTablePageSizeCookieName(tableId);
  const prefix = `${cookieName}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!entry) return null;

  return parseTablePageSize(entry.slice(prefix.length), DEFAULT_TABLE_PAGE_SIZES[tableId]);
}

export function setTablePageSizeCookie(tableId: TablePageSizeId, pageSize: TablePageSize) {
  const cookieName =
    tableId === "dashboard" ? DASHBOARD_PAGE_SIZE_COOKIE : getTablePageSizeCookieName(tableId);
  document.cookie = `${cookieName}=${pageSize}; path=/; max-age=31536000; SameSite=Lax`;
}

export function useTablePageSize(tableId: TablePageSizeId) {
  const router = useRouter();
  const defaultSize = DEFAULT_TABLE_PAGE_SIZES[tableId];
  const [pageSize, setPageSizeState] = useState<TablePageSize>(() => readStoredPageSize(tableId));
  const syncedCookie = useRef(false);

  const setPageSize = useCallback(
    (size: TablePageSize) => {
      localStorage.setItem(getTablePageSizeStorageKey(tableId), String(size));
      setPageSizeState(size);
      setTablePageSizeCookie(tableId, size);
    },
    [tableId],
  );

  useEffect(() => {
    if (syncedCookie.current) return;

    const stored = readStoredPageSize(tableId);
    const cookieValue = readPageSizeCookie(tableId);
    syncedCookie.current = true;
    if (cookieValue === stored) return;

    setTablePageSizeCookie(tableId, stored);
    router.refresh();
  }, [tableId, router]);

  return { pageSize, defaultSize, setPageSize };
}

// Legacy export kept for dashboard footer until fully migrated to DataTableFooter.
export function setDashboardPageSizeCookie(pageSize: TablePageSize) {
  setTablePageSizeCookie("dashboard", pageSize);
}
