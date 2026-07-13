import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  setTablePageSizeCookie,
  setDashboardPageSizeCookie,
  useTablePageSize,
} from "./use-table-page-size";

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

function clearCookies() {
  for (const entry of document.cookie.split("; ")) {
    const name = entry.split("=")[0];
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

describe("use-table-page-size", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearCookies();
  });

  afterEach(() => {
    clearCookies();
  });

  describe("setTablePageSizeCookie", () => {
    it("écrit un cookie préfixé par table pour une table nommée", () => {
      setTablePageSizeCookie("pieces", 30);

      expect(document.cookie).toContain("dahlia-table-page-size-pieces=30");
    });

    it("utilise le cookie historique pour le dashboard", () => {
      setTablePageSizeCookie("dashboard", 100);

      expect(document.cookie).toContain("dahlia-table-page-size=100");
    });
  });

  it("setDashboardPageSizeCookie écrit le cookie du dashboard", () => {
    setDashboardPageSizeCookie(30);

    expect(document.cookie).toContain("dahlia-table-page-size=30");
  });

  describe("useTablePageSize", () => {
    it("retourne la taille par défaut de la table quand rien n'est stocké", () => {
      const { result } = renderHook(() => useTablePageSize("pieces"));

      expect(result.current.pageSize).toBe(10);
      expect(result.current.defaultSize).toBe(10);
    });

    it("lit la taille stockée dans localStorage", () => {
      localStorage.setItem("dahlia:tablePageSize:pieces", "30");

      const { result } = renderHook(() => useTablePageSize("pieces"));

      expect(result.current.pageSize).toBe(30);
    });

    it("setPageSize met à jour l'état, le localStorage et le cookie", () => {
      const { result } = renderHook(() => useTablePageSize("pieces"));

      act(() => {
        result.current.setPageSize(100);
      });

      expect(result.current.pageSize).toBe(100);
      expect(localStorage.getItem("dahlia:tablePageSize:pieces")).toBe("100");
      expect(document.cookie).toContain("dahlia-table-page-size-pieces=100");
    });
  });
});
