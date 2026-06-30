import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PIECES_PARAMS } from "@/app/lib/pieces-table";
import { DataTableFooter } from "./data-table-footer";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSetTablePageSizeCookie = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: vi.fn(),
}));

vi.mock("@/app/ui/use-table-page-size", () => ({
  setTablePageSizeCookie: (...args: unknown[]) => mockSetTablePageSizeCookie(...args),
}));

import { useSearchParams } from "next/navigation";

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

describe("DataTableFooter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le sélecteur de taille de page", () => {
    render(
      <DataTableFooter
        params={PIECES_PARAMS}
        tableId="pieces"
        currentPage={1}
        totalPages={1}
        pageSize={10}
      />,
    );

    expect(screen.getByLabelText("Résultats par page")).toBeTruthy();
  });

  it("masque la pagination quand totalPages vaut 1", () => {
    render(
      <DataTableFooter
        params={PIECES_PARAMS}
        tableId="pieces"
        currentPage={1}
        totalPages={1}
        pageSize={10}
      />,
    );

    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("construit les liens de pagination en conservant les paramètres courants", () => {
    setSearchParams("pcPage=1&pcSort=date&tab=pieces");
    render(
      <DataTableFooter
        params={PIECES_PARAMS}
        tableId="pieces"
        currentPage={1}
        totalPages={3}
        pageSize={10}
      />,
    );

    const page2Link = screen.getByRole("link", { name: "2" });
    const href = page2Link.getAttribute("href") ?? "";
    expect(href).toContain("pcPage=2");
    expect(href).toContain("pcSort=date");
    expect(href).toContain("tab=pieces");
  });

  it("inclut preserveParams dans les liens de pagination", () => {
    setSearchParams("pcPage=1");
    render(
      <DataTableFooter
        params={PIECES_PARAMS}
        tableId="pieces"
        currentPage={1}
        totalPages={3}
        pageSize={10}
        preserveParams={{ statut: "en_cours" }}
      />,
    );

    const page2Link = screen.getByRole("link", { name: "2" });
    expect(page2Link.getAttribute("href")).toContain("statut=en_cours");
  });

  it("met à jour le cookie, revient à la page 1 et rafraîchit lors du changement de taille", () => {
    setSearchParams("pcPage=3&pcSort=date&tab=pieces");
    render(
      <DataTableFooter
        params={PIECES_PARAMS}
        tableId="pieces"
        currentPage={3}
        totalPages={5}
        pageSize={10}
        preserveParams={{ statut: "en_cours" }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Résultats par page"), { target: { value: "30" } });

    expect(mockSetTablePageSizeCookie).toHaveBeenCalledWith("pieces", 30);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("pcPage=1");
    expect(pushedUrl).toContain("pcSort=date");
    expect(pushedUrl).toContain("tab=pieces");
    expect(pushedUrl).toContain("statut=en_cours");
    expect(mockPush).toHaveBeenCalledWith(expect.any(String), { scroll: false });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
