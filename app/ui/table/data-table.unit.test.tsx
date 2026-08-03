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
    facetFields: [{ key: "type", label: "Type" }],
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

  it("utilise facetFields pour le filtre quand la clé diffère de la clé de colonne", () => {
    const dossierColumns = [
      {
        key: "caseFileNumber",
        label: "Dossier",
        sortable: true,
        facetFields: [{ key: "dossier", label: "Numéro" }],
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

  it("injecte des règles CSS de colonnes via colgroup en layout fixe", () => {
    const sizedColumns = [
      {
        key: "dossier",
        label: "Dossier",
        width: "40rem",
        render: (row: Row) => row.name,
      },
      {
        key: "date",
        label: "Date",
        width: "9rem",
        render: (row: Row) => row.type,
      },
    ];

    const { container } = render(<DataTable {...baseProps} columns={sizedColumns} />);

    const style = container.querySelector("style");
    expect(style?.textContent).not.toContain("@media");
    expect(style?.textContent).toContain("table-layout: fixed");
    expect(style?.textContent).not.toContain("min-width:");
    expect(style?.textContent).toContain(".dt-sizing-pieces col:nth-child(1){width:40rem;}");
    expect(style?.textContent).toContain(".dt-sizing-pieces col:nth-child(2){width:9rem;}");
    expect(container.querySelector(".dt-sizing-pieces col")).toBeTruthy();
    expect(container.querySelector(".dt-sizing-pieces")).toBeTruthy();
    expect(container.querySelector(".fr-table--layout-fixed")).toBeTruthy();
  });

  it("injecte min-width sur le tableau quand minWidth est fourni", () => {
    const { container } = render(<DataTable {...baseProps} minWidth="50rem" />);

    const style = container.querySelector("style");
    expect(style?.textContent).toContain("min-width: 50rem;");
  });
});
