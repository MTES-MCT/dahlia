import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CaseFilesSearchBar } from "./case-files-search-bar";

function getInput(): HTMLInputElement {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

describe("CaseFilesSearchBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("pré-remplit le champ avec la valeur courante de dahliaq", () => {
    render(<CaseFilesSearchBar currentQuery="dupont" />);

    expect(getInput().defaultValue).toBe("dupont");
    expect(getInput().name).toBe("dahliaq");
  });

  it("rend un champ vide quand currentQuery est vide", () => {
    render(<CaseFilesSearchBar currentQuery="" />);

    expect(getInput().defaultValue).toBe("");
  });
});
