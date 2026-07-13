import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PIECES_FACET_KEYS, PIECES_PARAMS } from "@/app/lib/pieces-table";
import { DataTable } from "./data-table";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/case_files/TA069-2026-001",
  useSearchParams: vi.fn(),
}));

vi.mock("@/app/ui/use-table-page-size", () => ({
  setTablePageSizeCookie: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

type Row = {
  name: string;
  type: string;
};

const columns = [
  {
    key: "name",
    label: "Nom",
    sortable: true,
    render: (row: Row) => row.name,
  },
  {
    key: "type",
    label: "Type",
    facet: true,
    render: (row: Row) => row.type,
  },
];

const baseSearch = {
  action: "/case_files/TA069-2026-001",
  currentQuery: "",
  hiddenParams: [{ name: "tab", value: "pieces" }],
  resetHref: "/case_files/TA069-2026-001?tab=pieces",
  label: "Rechercher une pièce",
  placeholder: "ex. « requête »",
};

const baseProps = {
  columns,
  rows: [{ name: "requete.pdf", type: "Requête" }],
  totalCount: 1,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10 as const,
  params: PIECES_PARAMS,
  tableId: "pieces" as const,
  facetKeys: PIECES_FACET_KEYS,
  caption: (count: number) => `${count} pièce${count > 1 ? "s" : ""}`,
  search: baseSearch,
};

describe("DataTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche la barre de recherche", () => {
    render(<DataTable {...baseProps} />);

    expect(screen.getByLabelText("Rechercher une pièce")).toBeTruthy();
    expect(screen.getByPlaceholderText("ex. « requête »")).toBeTruthy();
  });

  it("affiche un contenu de recherche personnalisé quand searchSlot est fourni", () => {
    render(
      <DataTable
        {...baseProps}
        search={{ ...baseSearch, searchSlot: <div>Recherche custom</div> }}
      />,
    );

    expect(screen.getByText("Recherche custom")).toBeTruthy();
    expect(screen.queryByLabelText("Rechercher une pièce")).toBeNull();
  });

  it("affiche la légende, les en-têtes et les cellules des lignes", () => {
    render(<DataTable {...baseProps} />);

    expect(screen.getByText("1 pièce")).toBeTruthy();
    expect(screen.getByText("requete.pdf")).toBeTruthy();
    expect(screen.getByText("Requête")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trier par Nom/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Filtrer par Type/ })).toBeTruthy();
  });

  it("utilise facetKey pour le filtre quand il diffère de la clé de colonne", () => {
    const dossierColumns = [
      {
        key: "caseFileNumber",
        label: "Dossier",
        sortable: true,
        facet: true,
        facetKey: "dossier",
        render: (row: { caseFileNumber: string }) => row.caseFileNumber,
      },
    ];

    render(
      <DataTable
        {...baseProps}
        columns={dossierColumns}
        rows={[{ caseFileNumber: "TA069/2026/001" }]}
        facetKeys={["dossier"]}
        caption={() => "1 dossier"}
        search={{ ...baseSearch, label: "Rechercher un dossier" }}
      />,
    );

    expect(screen.getByRole("button", { name: /Filtrer par Dossier/ })).toBeTruthy();
  });

  it("affiche le pied de page avec le sélecteur de taille de page", () => {
    render(<DataTable {...baseProps} />);

    expect(screen.getByLabelText("Résultats par page")).toBeTruthy();
  });
});
