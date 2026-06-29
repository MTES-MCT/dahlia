"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type TablePageSize,
  type TablePageSizeId,
  DEFAULT_TABLE_PAGE_SIZES,
  DASHBOARD_PAGE_SIZE_COOKIE,
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

function readDashboardPageSizeCookie(): TablePageSize | null {
  if (typeof document === "undefined") return null;

  const prefix = `${DASHBOARD_PAGE_SIZE_COOKIE}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!entry) return null;

  return parseTablePageSize(
    entry.slice(prefix.length),
    DEFAULT_TABLE_PAGE_SIZES.dashboard,
  );
}

export function setDashboardPageSizeCookie(pageSize: TablePageSize) {
  document.cookie = `${DASHBOARD_PAGE_SIZE_COOKIE}=${pageSize}; path=/; max-age=31536000; SameSite=Lax`;
}

export function useTablePageSize(tableId: TablePageSizeId) {
  const router = useRouter();
  const defaultSize = DEFAULT_TABLE_PAGE_SIZES[tableId];
  const [pageSize, setPageSizeState] = useState<TablePageSize>(() => readStoredPageSize(tableId));
  const syncedDashboardCookie = useRef(false);

  const setPageSize = useCallback(
    (size: TablePageSize) => {
      localStorage.setItem(getTablePageSizeStorageKey(tableId), String(size));
      setPageSizeState(size);
      if (tableId === "dashboard") {
        setDashboardPageSizeCookie(size);
      }
    },
    [tableId],
  );

  useEffect(() => {
    if (tableId !== "dashboard" || syncedDashboardCookie.current) return;

    const stored = readStoredPageSize("dashboard");
    const cookieValue = readDashboardPageSizeCookie();
    syncedDashboardCookie.current = true;
    if (cookieValue === stored) return;

    setDashboardPageSizeCookie(stored);
    router.refresh();
  }, [tableId, router]);

  return { pageSize, defaultSize, setPageSize };
}
