import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CaseFilesSearchByStatus } from "./case-files-search-by-status";

const OPTIONS = ["En cours d'instruction", "Terminé", "Recours en appel"];

// Default status preselected when `statut` is absent from the URL (one of OPTIONS).
const DEFAULT_STATUT = "En cours d'instruction";

function getSelect(): HTMLSelectElement {
  return screen.getByRole("combobox") as HTMLSelectElement;
}

describe("CaseFilesSearchByStatus", () => {
  afterEach(() => {
    cleanup();
  });

  it("expose un champ select nommé statut", () => {
    render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

    expect(getSelect().name).toBe("statut");
  });

  it('affiche une option "Tous" en premier avec une valeur vide', () => {
    render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options[0].value).toBe("");
    expect(options[0].textContent).toBe("Tous");
  });

  it("affiche une option par libellé fourni", () => {
    render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options).toHaveLength(OPTIONS.length + 1);
    OPTIONS.forEach((label, index) => {
      expect(options[index + 1].value).toBe(label);
      expect(options[index + 1].textContent).toBe(label);
    });
  });

  it("présélectionne le statut par défaut quand statutParam est absent", () => {
    render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

    expect(getSelect().value).toBe(DEFAULT_STATUT);
  });

  it("présélectionne la valeur courante de statut quand statutParam est fourni", () => {
    render(
      <CaseFilesSearchByStatus
        options={OPTIONS}
        defaultStatut={DEFAULT_STATUT}
        statutParam="Terminé"
      />,
    );

    expect(getSelect().value).toBe("Terminé");
  });

  it('présélectionne "Tous" quand statutParam est une chaîne vide', () => {
    render(
      <CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} statutParam="" />,
    );

    expect(getSelect().value).toBe("");
  });

  it('présélectionne "Tous" quand le statut par défaut est absent', () => {
    render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={null} />);

    expect(getSelect().value).toBe("");
  });
});
