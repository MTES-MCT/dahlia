import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { ClientTable, type ClientTableColumn } from "./client-table";

// The table and its sub-controls read all their state from the URL.
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/case_files/TA069-2026-001",
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

type Row = { name: string; city: string };

const rows: Row[] = [
  { name: "Dupont", city: "Lyon" },
  { name: "Martin", city: "Paris" },
  { name: "Durand", city: "Lyon" },
];

const columns: ClientTableColumn<Row>[] = [
  {
    key: "name",
    label: "Nom",
    text: (row) => row.name,
    sortValue: (row) => row.name,
    searchable: true,
    sortable: true,
  },
  { key: "city", label: "Ville", text: (row) => row.city, facet: true },
];

const params = { page: "pcPage", sortBy: "pcSort", sortOrder: "pcOrder", query: "pcq" };

function renderTable(overrides: Partial<Parameters<typeof ClientTable<Row>>[0]> = {}) {
  return render(
    <ClientTable<Row>
      rows={rows}
      columns={columns}
      params={params}
      pageSize={2}
      caption={(total) => `${total} ligne(s)`}
      defaultSortBy="name"
      defaultOrder="ascending"
      searchLabel="Rechercher"
      {...overrides}
    />,
  );
}

describe("ClientTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche la caption construite à partir du nombre total de lignes", () => {
    renderTable();

    expect(screen.getByText("3 ligne(s)")).toBeTruthy();
  });

  it("affiche les en-têtes de colonnes", () => {
    renderTable();

    expect(screen.getByText("Ville")).toBeTruthy();
    expect(screen.getAllByText("Nom").length).toBeGreaterThan(0);
  });

  it("rend uniquement la première page selon pageSize", () => {
    renderTable();

    // pageSize = 2, default sort name ascending → Dupont, Durand sur la page 1.
    expect(screen.getByText("Dupont")).toBeTruthy();
    expect(screen.getByText("Durand")).toBeTruthy();
    expect(screen.queryByText("Martin")).toBeNull();
  });

  it("affiche la pagination quand le nombre de lignes dépasse pageSize", () => {
    renderTable();

    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeTruthy();
  });

  it("masque la pagination quand tout tient sur une page", () => {
    renderTable({ pageSize: 10 });

    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
  });

  it("filtre les lignes via la facette dans l'URL", () => {
    setSearchParams("pcq=city:paris");
    renderTable();

    expect(screen.getByText("1 ligne(s)")).toBeTruthy();
    expect(screen.getByText("Martin")).toBeTruthy();
    expect(screen.queryByText("Dupont")).toBeNull();
  });

  it("utilise le renderer de cellule personnalisé quand il est fourni", () => {
    const customColumns: ClientTableColumn<Row>[] = [
      { ...columns[0], render: (row) => <em>{`★ ${row.name}`}</em> },
      columns[1],
    ];
    renderTable({ columns: customColumns });

    expect(screen.getByText("★ Dupont")).toBeTruthy();
  });

  it("respecte le tri descendant fourni dans l'URL", () => {
    setSearchParams("pcSort=name&pcOrder=descending");
    renderTable();

    const bodyRows = screen.getAllByRole("row");
    // Première ligne de données après l'en-tête : Martin (ordre décroissant).
    const firstDataRow = bodyRows[1];
    expect(within(firstDataRow).getByText("Martin")).toBeTruthy();
  });
});
