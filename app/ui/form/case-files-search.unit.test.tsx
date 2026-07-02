import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { buildCaseFilesSearchConfig } from "./case-files-search";
import { TableSearchForm } from "@/app/ui/form/table-search-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const OPTIONS = ["En cours d'instruction", "Terminé"];
const DEFAULT_STATUT = "En cours d'instruction";

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
    <TableSearchForm params={DASHBOARD_TABLE_PARAMS} {...buildCaseFilesSearchConfig(props)} />,
  );
}

describe("buildCaseFilesSearchConfig", () => {
  afterEach(() => {
    cleanup();
  });

  it("est un form GET vers /case_files sans champ page", () => {
    renderDashboardSearch({
      statusOptions: OPTIONS,
      defaultStatut: DEFAULT_STATUT,
      currentQuery: "",
    });

    const form = getForm();
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/case_files");
    // No page field → submitting resets pagination to page 1.
    expect(form.querySelector('input[name="page"]')).toBeNull();
  });

  it("englobe le filtre statut et le champ texte", () => {
    renderDashboardSearch({
      statusOptions: OPTIONS,
      defaultStatut: DEFAULT_STATUT,
      currentQuery: "dupont",
      statutParam: "Terminé",
    });

    const form = getForm();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    // Both fields live inside the same form.
    expect(form.contains(select)).toBe(true);
    expect(form.contains(input)).toBe(true);
    expect(select.name).toBe("statut");
    expect(select.value).toBe("Terminé");
    expect(input.name).toBe("dahliaq");
    expect(input.defaultValue).toBe("dupont");
  });

  it("affiche un bouton « Rechercher » et un lien de réinitialisation", () => {
    renderDashboardSearch({
      statusOptions: OPTIONS,
      defaultStatut: DEFAULT_STATUT,
      currentQuery: "",
    });

    const button = screen.getByRole("button", { name: "Rechercher" });
    expect(button.getAttribute("type")).toBe("submit");

    const resetLink = screen.getByRole("link", { name: /Ré-initialiser la recherche/ });
    expect(resetLink.getAttribute("href")).toBe("/case_files");
  });

  it("rend les champs cachés sortBy/sortOrder quand ils sont fournis", () => {
    renderDashboardSearch({
      statusOptions: OPTIONS,
      defaultStatut: DEFAULT_STATUT,
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
      statusOptions: OPTIONS,
      defaultStatut: DEFAULT_STATUT,
      currentQuery: "",
      sortOrderParam: "ascending",
    });

    const form = getForm();
    expect(hiddenValue(form, "sortBy")).toBeUndefined();
    expect(hiddenValue(form, "sortOrder")).toBeUndefined();
  });
});
