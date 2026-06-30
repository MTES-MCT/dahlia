import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TableSearchBar } from "./table-search-bar";

function getInput(): HTMLInputElement {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

describe("TableSearchBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("rend un champ non contrôlé avec le nom et la valeur par défaut fournis", () => {
    render(<TableSearchBar name="objetq" label="Rechercher" defaultValue="dupont" />);

    const input = getInput();
    expect(input.name).toBe("objetq");
    expect(input.value).toBe("dupont");
    expect(input.id).toBe("objetq-search");
  });

  it("laisse l'utilisateur modifier librement la valeur (non contrôlé)", () => {
    render(<TableSearchBar name="objetq" label="Rechercher" defaultValue="" />);

    fireEvent.change(getInput(), { target: { value: "martin" } });

    expect(getInput().value).toBe("martin");
  });

  it("affiche le placeholder fourni", () => {
    render(
      <TableSearchBar
        name="objetq"
        label="Rechercher"
        defaultValue=""
        placeholder="ex. « audience »"
      />,
    );

    expect(getInput().placeholder).toBe("ex. « audience »");
  });
});
