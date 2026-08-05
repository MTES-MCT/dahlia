import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ColumnHeader } from "./column-header";

// The composed sort/filter controls read the URL via next/navigation.
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

describe("ColumnHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le label en texte simple quand la colonne n'est ni triable ni filtrable", () => {
    render(<ColumnHeader label="Numéro" />);

    expect(screen.getByText("Numéro")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rend le contrôle de tri quand sortKey est fourni", () => {
    render(<ColumnHeader label="Numéro" sortKey="caseFileNumber" />);

    expect(screen.getByRole("button", { name: /Trier par Numéro/ })).toBeTruthy();
  });

  it("rend le bouton de filtre quand facetFields est fourni", () => {
    render(
      <ColumnHeader label="Requérant" facetFields={[{ key: "requerant", label: "Requérant" }]} />,
    );

    expect(screen.getByRole("button", { name: /Filtrer par Requérant/ })).toBeTruthy();
  });

  it("rend à la fois le tri et le filtre quand sortKey et facetFields sont fournis", () => {
    render(
      <ColumnHeader
        label="Requérant"
        sortKey="requerant"
        facetFields={[{ key: "requerant", label: "Requérant" }]}
      />,
    );

    expect(screen.getByRole("button", { name: /Trier par Requérant/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Filtrer par Requérant/ })).toBeTruthy();
  });
});
