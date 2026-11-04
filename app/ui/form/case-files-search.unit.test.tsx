import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { buildCaseFilesSearchConfig } from "./case-files-search";
import { SavedSearches } from "@/app/ui/form/saved-searches";
import { TableSearchForm } from "@/app/ui/form/table-search-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(protected)/case_files/actions", () => ({
  saveSearchFormAction: vi.fn(),
  deleteSavedSearchFormAction: vi.fn(),
}));

function getForm(): HTMLFormElement {
  return screen.getByRole("search") as HTMLFormElement;
}

// Read the hidden field value by name, or undefined when the field is absent.
function hiddenValue(form: HTMLFormElement, name: string): string | undefined {
  const field = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  return field?.value;
}

function renderDashboardSearch(props: Parameters<typeof buildCaseFilesSearchConfig>[0]) {
  render(
    <SavedSearches searches={[]} currentQuery={props.currentQuery} currentGroup="en_cours">
      <TableSearchForm params={DASHBOARD_TABLE_PARAMS} {...buildCaseFilesSearchConfig(props)} />
    </SavedSearches>,
  );
}

describe("buildCaseFilesSearchConfig", () => {
  afterEach(() => {
    cleanup();
  });

  it("est un form GET vers /case_files sans champ page", () => {
    renderDashboardSearch({
      currentQuery: "",
    });

    const form = getForm();
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/case_files");
    // No page field → submitting resets pagination to page 1.
    expect(form.querySelector('input[name="page"]')).toBeNull();
  });

  it("contient le champ principal et le panneau « Filtres avancés », sans select statut", () => {
    renderDashboardSearch({ currentQuery: "dupont" });

    const form = getForm();
    const input = screen.getByLabelText("Rechercher") as HTMLInputElement;
    expect(form.contains(input)).toBe(true);
    expect(input.value).toBe("dupont");
    // The query is submitted through a hidden field combining text and facets.
    expect(hiddenValue(form, "dahliaq")).toBe("dupont");
    expect(screen.queryByRole("combobox")).toBeNull();

    const summary = screen.getByText("Filtres avancés");
    expect(summary.tagName).toBe("SUMMARY");
    expect(form.contains(summary)).toBe(true);
  });

  it("rend le groupe de statuts en champ caché", () => {
    renderDashboardSearch({ currentQuery: "", statusGroup: "termine" });

    expect(hiddenValue(getForm(), "groupe")).toBe("termine");
  });

  it("affiche un bouton « Rechercher » sans lien de réinitialisation", () => {
    renderDashboardSearch({
      currentQuery: "",
    });

    const button = screen.getByRole("button", { name: "Rechercher" });
    expect(button.getAttribute("type")).toBe("submit");

    expect(screen.queryByRole("link", { name: /Ré-initialiser la recherche/ })).toBeNull();
  });

  it("rend les champs cachés sortBy/sortOrder quand ils sont fournis", () => {
    renderDashboardSearch({
      currentQuery: "",
      sortByParam: "caseFileNumber",
      sortOrderParam: "ascending",
    });

    const form = getForm();
    expect(hiddenValue(form, "sortBy")).toBe("caseFileNumber");
    expect(hiddenValue(form, "sortOrder")).toBe("ascending");
  });

  it("n'émet pas de tri caché tant que sortBy est absent", () => {
    renderDashboardSearch({
      currentQuery: "",
      sortOrderParam: "ascending",
    });

    const form = getForm();
    expect(hiddenValue(form, "sortBy")).toBeUndefined();
    expect(hiddenValue(form, "sortOrder")).toBeUndefined();
  });

  it("propose la sauvegarde à côté du bouton Rechercher quand une recherche est affichée", () => {
    renderDashboardSearch({ currentQuery: "dupont" });

    const searchButton = screen.getByRole("button", { name: "Rechercher" });
    const saveButton = screen.getByRole("button", { name: "Sauvegarder la recherche courante" });
    expect(searchButton.parentElement?.contains(saveButton)).toBe(true);
  });

  it("ne propose pas de sauvegarde à côté du bouton Rechercher sans critère affiché", () => {
    renderDashboardSearch({ currentQuery: "" });

    expect(screen.queryByRole("button", { name: /Sauvegarder la recherche/ })).toBeNull();
  });
});
