import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { HiddenField } from "./hidden-field";

function getHiddenInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input[type="hidden"]');
}

describe("HiddenField", () => {
  afterEach(() => {
    cleanup();
  });

  it("rend un champ caché avec le nom et la valeur fournis", () => {
    const { container } = render(<HiddenField name="sortBy" value="nom" />);

    const input = getHiddenInput(container);
    expect(input).not.toBeNull();
    expect(input?.name).toBe("sortBy");
    expect(input?.value).toBe("nom");
  });

  it("rend une valeur vide quand value est vide", () => {
    const { container } = render(<HiddenField name="page" value="" />);

    expect(getHiddenInput(container)?.value).toBe("");
  });
});
