import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TagPicker } from "@/app/ui/form/tag-picker";

const AVAILABLE_TAGS = [
  { id: 1, label: "Urgent", color: "pink-tuile" },
  { id: 2, label: "À relancer", color: "green-menthe" },
  { id: 3, label: "Étranger", color: "blue-cumulus" },
];

function renderPicker(defaultSelectedIds: number[] = []) {
  return render(
    <TagPicker availableTags={AVAILABLE_TAGS} defaultSelectedIds={defaultSelectedIds} />,
  );
}

function getCombobox() {
  return screen.getByRole("combobox", { name: /Tags/ });
}

function focusInput() {
  fireEvent.focus(getCombobox());
}

function type(value: string) {
  fireEvent.change(getCombobox(), { target: { value } });
}

// The list only opens once something is typed, so most cases focus then type.
function openListWith(value: string) {
  focusInput();
  type(value);
}

function selectedTagIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLInputElement>('input[name="tagIds"]')].map(
    (input) => input.value,
  );
}

describe("TagPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("marque la présence du champ pour l'action serveur", () => {
    const { container } = renderPicker();

    expect(container.querySelector('input[name="hasTagsField"]')?.getAttribute("value")).toBe(
      "true",
    );
  });

  it("n'ouvre aucune liste au focus tant que rien n'est saisi", () => {
    renderPicker();

    focusInput();

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByText("Aucun tag correspondant.")).toBeNull();
    expect(getCombobox().getAttribute("aria-expanded")).toBe("false");
  });

  it("ouvre la liste dès la première lettre saisie", () => {
    renderPicker();

    openListWith("u");

    expect(getCombobox().getAttribute("aria-expanded")).toBe("true");
    expect(within(screen.getByRole("listbox")).getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("referme la liste quand la saisie est effacée", () => {
    renderPicker();

    openListWith("u");
    type("");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(getCombobox().getAttribute("aria-expanded")).toBe("false");
  });

  it("ignore une saisie faite uniquement d'espaces", () => {
    renderPicker();

    openListWith("   ");

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("filtre la liste à la saisie, sans tenir compte des accents ni de la casse", () => {
    renderPicker();

    openListWith("etra");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Étranger");
  });

  it("affiche un message quand aucun tag ne correspond", () => {
    renderPicker();

    openListWith("zzz");

    expect(screen.getByText("Aucun tag correspondant.")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // The options are rendered as tags; the browser's default bullets are off.
  it("n'affiche pas de puce devant les tags proposés", () => {
    renderPicker();

    openListWith("u");

    const listbox = screen.getByRole("listbox");
    expect(listbox.className).toContain("list-none");
    for (const option of within(listbox).getAllByRole("option")) {
      expect(option.className).toContain("list-none");
    }
  });

  // Tags are administered in /admin/tags: the picker never offers to create one.
  it("ne propose jamais de créer un tag", () => {
    renderPicker();

    openListWith("nouveau tag");

    expect(screen.queryByText(/Créer/i)).toBeNull();
  });

  it("ajoute un tag au clic, vide la saisie et referme la liste", () => {
    const { container } = renderPicker();

    openListWith("urgent");
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Urgent"));

    expect(selectedTagIds(container)).toEqual(["1"]);
    expect((getCombobox() as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("retire des suggestions un tag déjà sélectionné", () => {
    renderPicker([1]);

    openListWith("urgent");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText("Aucun tag correspondant.")).toBeTruthy();
  });

  it("sélectionne au clavier avec les flèches et Entrée", () => {
    const { container } = renderPicker();

    // "Urgent", "À relancer" and "Étranger" all contain an "r", so the list
    // keeps the catalogue order: Urgent (1), À relancer (2), Étranger (3).
    openListWith("r");
    fireEvent.keyDown(getCombobox(), { key: "ArrowDown" });
    fireEvent.keyDown(getCombobox(), { key: "Enter" });

    // ArrowDown moves the highlight from the first option to the second.
    expect(selectedTagIds(container)).toEqual(["2"]);
  });

  it("lie l'option active au combobox via aria-activedescendant", () => {
    renderPicker();

    openListWith("u");

    const activeId = getCombobox().getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId as string)?.getAttribute("aria-selected")).toBe("true");
  });

  it("ferme la liste avec Échap", () => {
    renderPicker();

    openListWith("u");
    fireEvent.keyDown(getCombobox(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(getCombobox().getAttribute("aria-expanded")).toBe("false");
  });

  it("affiche les tags déjà posés et permet de les retirer", () => {
    const { container } = renderPicker([1, 2]);

    expect(selectedTagIds(container)).toEqual(["1", "2"]);

    fireEvent.click(screen.getByRole("button", { name: "Retirer le tag Urgent" }));

    expect(selectedTagIds(container)).toEqual(["2"]);
  });

  // The chips must follow the field so the suggestion popover never shifts them.
  it("affiche les tags sélectionnés sous l'input", () => {
    const { container } = renderPicker([1]);

    const field = container.querySelector(".fr-input-group") as HTMLElement;
    const chips = screen.getByRole("list", { name: "Tags sélectionnés" });

    expect(field).toBeTruthy();
    expect(chips).toBeTruthy();
    expect(field.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("retire le dernier tag avec Retour arrière sur une saisie vide", () => {
    const { container } = renderPicker([1, 2]);

    focusInput();
    fireEvent.keyDown(getCombobox(), { key: "Backspace" });

    expect(selectedTagIds(container)).toEqual(["1"]);
  });

  // Selected tags look like every other tag (a small coloured badge); the
  // surrounding button carries the removal and its accessible name.
  it("rend les tags sélectionnés en petits badges colorés dans un bouton de retrait", () => {
    renderPicker([1]);

    const button = screen.getByRole("button", { name: "Retirer le tag Urgent" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).not.toContain("fr-tag");

    const badge = within(button).getByText("Urgent");
    expect(badge.className).toContain("fr-badge--sm");
    expect(badge.className).toContain("fr-badge--pink-tuile");
    expect(badge.querySelector(".fr-icon-close-line")?.getAttribute("aria-hidden")).toBe("true");
  });

  // Read-only suggestions are badges: a `<span>` DSFR tag would render grey.
  it("rend les suggestions en petits badges colorés", () => {
    renderPicker();

    openListWith("urgent");

    const suggestion = within(screen.getByRole("listbox")).getByText("Urgent");
    expect(suggestion.className).toContain("fr-badge--sm");
    expect(suggestion.className).toContain("fr-badge--pink-tuile");
  });
});
