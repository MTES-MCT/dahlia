import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ColumnFilterButton } from "./column-filter-button";
import { DOSSIER_FACET_FIELDS } from "@/app/lib/case-file-search";

const REQUERANT_FACET_FIELDS = [{ key: "requerant", label: "Requérant" }] as const;

// The button reads the current search from the URL and pushes the updated one.
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

function getToggleButton(): HTMLElement {
  return screen.getByRole("button", { name: /Filtrer par Requérant/ });
}

describe("ColumnFilterButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  afterEach(() => {
    cleanup();
  });

  it("n'affiche pas le popover tant que le bouton n'est pas cliqué", () => {
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getToggleButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("ouvre le popover au clic et seede le champ avec la valeur de facette courante", () => {
    setSearchParams("dahliaq=requerant:dupont");
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    fireEvent.click(getToggleButton());

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("dupont");
  });

  it("marque le bouton comme actif quand une facette est déjà présente", () => {
    setSearchParams("dahliaq=requerant:dupont");
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    expect(getToggleButton().getAttribute("aria-label")).toContain("filtre actif : Requérant : dupont");
  });

  it("injecte la facette dans la recherche et réinitialise la page au submit", () => {
    setSearchParams("page=3");
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    fireEvent.click(getToggleButton());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "martin" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrer" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(decodeURIComponent(pushedUrl)).toContain("dahliaq=requerant:martin");
    expect(pushedUrl).not.toContain("page=");
  });

  it("soumet à la touche Entrée dans le champ", () => {
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    fireEvent.click(getToggleButton());
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "durand" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(decodeURIComponent(pushedUrl)).toContain("dahliaq=requerant:durand");
  });

  it("retire le paramètre de recherche quand la valeur soumise est vide", () => {
    setSearchParams("dahliaq=requerant:dupont");
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    fireEvent.click(getToggleButton());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrer" }));

    expect(mockPush).toHaveBeenCalledWith("?", { scroll: false });
  });

  it("ferme le popover à la touche Échap", () => {
    render(<ColumnFilterButton label="Requérant" facetFields={REQUERANT_FACET_FIELDS} />);

    fireEvent.click(getToggleButton());
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("mode multi-champs (colonne Dossier)", () => {
    function getDossierToggleButton(): HTMLElement {
      return screen.getByRole("button", { name: /Filtrer par Dossier/ });
    }

    it("affiche un champ par type de recherche dossier", () => {
      render(
        <ColumnFilterButton label="Dossier" facetFields={DOSSIER_FACET_FIELDS} />,
      );

      fireEvent.click(getDossierToggleButton());

      expect(screen.getByPlaceholderText("Numéro")).toBeTruthy();
      expect(screen.getByPlaceholderText("Titre")).toBeTruthy();
      expect(screen.getByPlaceholderText("Requérant")).toBeTruthy();
      expect(screen.getByPlaceholderText("Défendeur")).toBeTruthy();
    });

    it("injecte plusieurs facettes dossier au submit", () => {
      setSearchParams("page=2");
      render(
        <ColumnFilterButton label="Dossier" facetFields={DOSSIER_FACET_FIELDS} />,
      );

      fireEvent.click(getDossierToggleButton());
      fireEvent.change(screen.getByPlaceholderText("Numéro"), { target: { value: "TA069" } });
      fireEvent.change(screen.getByPlaceholderText("Requérant"), { target: { value: "prefet" } });
      fireEvent.click(screen.getByRole("button", { name: "Filtrer" }));

      expect(mockPush).toHaveBeenCalledTimes(1);
      const pushedUrl = decodeURIComponent(mockPush.mock.calls[0][0] as string);
      expect(pushedUrl).toContain("dahliaq=dossier:TA069");
      expect(pushedUrl).toContain("requerant:prefet");
      expect(pushedUrl).not.toContain("page=");
    });

    it("seede chaque champ avec la facette courante", () => {
      setSearchParams("dahliaq=dossier:TA069%20requerant:dupont%20titre:prefet");
      render(
        <ColumnFilterButton label="Dossier" facetFields={DOSSIER_FACET_FIELDS} />,
      );

      fireEvent.click(getDossierToggleButton());

      expect((screen.getByPlaceholderText("Numéro") as HTMLInputElement).value).toBe("TA069");
      expect((screen.getByPlaceholderText("Requérant") as HTMLInputElement).value).toBe("dupont");
      expect((screen.getByPlaceholderText("Titre") as HTMLInputElement).value).toBe("prefet");
    });
  });
});
