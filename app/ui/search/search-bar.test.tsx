import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SearchBar } from "./search-bar";

function getInput(): HTMLInputElement {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

describe("SearchBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("rend un champ de recherche avec l'id, le nom et la valeur par défaut fournis", () => {
    render(
      <SearchBar id="dahlia-search" name="dahliaq" label="Rechercher" defaultValue="dupont" />,
    );

    const input = getInput();
    expect(input.id).toBe("dahlia-search");
    expect(input.name).toBe("dahliaq");
    expect(input.value).toBe("dupont");
  });

  it("laisse l'utilisateur modifier librement la valeur (non contrôlé)", () => {
    render(<SearchBar id="dahlia-search" name="dahliaq" label="Rechercher" defaultValue="" />);

    fireEvent.change(getInput(), { target: { value: "martin" } });

    expect(getInput().value).toBe("martin");
  });

  it("affiche le placeholder fourni", () => {
    render(
      <SearchBar
        id="dahlia-search"
        name="dahliaq"
        label="Rechercher"
        defaultValue=""
        placeholder="ex. « audience »"
      />,
    );

    expect(getInput().placeholder).toBe("ex. « audience »");
  });

  it("affiche le label fourni", () => {
    render(
      <SearchBar id="dahlia-search" name="dahliaq" label="Rechercher un dossier" defaultValue="" />,
    );

    expect(screen.getByText("Rechercher un dossier")).toBeTruthy();
  });
});
