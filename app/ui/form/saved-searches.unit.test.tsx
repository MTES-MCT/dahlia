import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { SaveSearchLink, SavedSearches } from "./saved-searches";
import { type SavedSearchView } from "@/app/lib/saved-searches";

const push = vi.fn();
const saveSearchFormAction = vi.fn(async () => ({ ok: true as const }));
const deleteSavedSearchFormAction = vi.fn(async () => ({ ok: true as const }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/app/(protected)/case_files/actions", () => ({
  saveSearchFormAction: (...args: unknown[]) => saveSearchFormAction(...(args as [])),
  deleteSavedSearchFormAction: (...args: unknown[]) => deleteSavedSearchFormAction(...(args as [])),
}));

const SEARCHES: SavedSearchView[] = [
  { id: 1, name: "Référés", query: "recours:Référé", statusGroup: "en_cours" },
  { id: 2, name: "Dupont terminés", query: "dupont", statusGroup: "termine" },
];

function mockDsfrModalApi() {
  // DSFR modals rely on window.dsfr(...).modal.disclose/conceal at runtime.
  (
    window as unknown as {
      dsfr: (element: HTMLElement) => { modal: { disclose: () => void; conceal: () => void } };
    }
  ).dsfr = (element: HTMLElement) => ({
    modal: {
      disclose: () => {
        element.setAttribute("open", "");
        element.classList.add("fr-modal--opened");
      },
      conceal: () => {
        element.removeAttribute("open");
        element.classList.remove("fr-modal--opened");
      },
    },
  });
}

function renderSearches(currentQuery: string, currentGroup: "en_cours" | "termine" | "tous") {
  return render(
    <>
      <SavedSearches
        searches={SEARCHES}
        currentQuery={currentQuery}
        currentGroup={currentGroup}
        sort={{ sortBy: "caseFileNumber" }}
      />
      <SaveSearchLink />
    </>,
  );
}

function select(): HTMLSelectElement {
  return screen.getByLabelText("Mes recherches") as HTMLSelectElement;
}

function modal(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

describe("SavedSearches", () => {
  beforeEach(() => {
    mockDsfrModalApi();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche un placeholder non sélectionnable puis le choix vide et les recherches", () => {
    renderSearches("", "en_cours");

    const [placeholder, ...options] = [...select().options];
    expect(placeholder.textContent).toBe("Choisir une recherche sauvegardée");
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.hidden).toBe(true);
    expect(options.map((option) => option.textContent)).toEqual(["", "Référés", "Dupont terminés"]);
    // No saved search displayed: the placeholder is shown.
    expect(select().selectedOptions[0]).toBe(placeholder);
  });

  it("n'affiche pas le select sans recherche sauvegardée", () => {
    render(<SavedSearches searches={[]} currentQuery="" currentGroup="en_cours" />);

    expect(screen.queryByLabelText("Mes recherches")).toBeNull();
  });

  it("présélectionne la recherche affichée et propose de la supprimer", () => {
    renderSearches("dupont", "termine");

    expect(select().value).toBe("2");
    expect(screen.getByRole("button", { name: "Supprimer cette recherche" })).toBeTruthy();
  });

  it("ne propose pas de suppression quand la recherche affichée n'est pas sauvegardée", () => {
    renderSearches("dupont", "en_cours");

    expect(select().value).toBe("");
    expect(screen.queryByRole("button", { name: "Supprimer cette recherche" })).toBeNull();
  });

  it("lance la recherche choisie dans son onglet en gardant le tri", () => {
    renderSearches("", "en_cours");

    fireEvent.change(select(), { target: { value: "2" } });

    expect(push).toHaveBeenCalledWith(
      "/case_files?sortBy=caseFileNumber&dahliaq=dupont&groupe=termine",
      { scroll: false },
    );
  });

  it("efface la recherche quand on revient au choix vide", () => {
    renderSearches("dupont", "termine");

    fireEvent.change(select(), { target: { value: "none" } });

    expect(push).toHaveBeenCalledWith("/case_files?sortBy=caseFileNumber&groupe=termine", {
      scroll: false,
    });
  });

  it("ouvre une modale de confirmation avant de supprimer", async () => {
    renderSearches("dupont", "termine");

    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette recherche" }));

    const dialog = modal("delete-saved-search-modal");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain("Dupont terminés");
    expect(deleteSavedSearchFormAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(deleteSavedSearchFormAction).toHaveBeenCalledTimes(1));
    const [, formData] = deleteSavedSearchFormAction.mock.calls[0] as unknown as [null, FormData];
    expect(formData.get("id")).toBe("2");
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });

  it("n'efface rien quand on annule la suppression", () => {
    renderSearches("dupont", "termine");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette recherche" }));
    const dialog = modal("delete-saved-search-modal");

    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));

    expect(dialog.hasAttribute("open")).toBe(false);
    expect(deleteSavedSearchFormAction).not.toHaveBeenCalled();
  });

  it("sauvegarde la recherche affichée sous le nom saisi", async () => {
    renderSearches("dupont statut:Terminé", "tous");

    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder la recherche" }));

    const dialog = modal("save-search-modal");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain("Critères : dupont statut:Terminé (Tous les dossiers)");

    fireEvent.change(within(dialog).getByLabelText("Nom de la recherche"), {
      target: { value: "Dupont" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(saveSearchFormAction).toHaveBeenCalledTimes(1));
    const [, formData] = saveSearchFormAction.mock.calls[0] as unknown as [null, FormData];
    expect(Object.fromEntries(formData.entries())).toEqual({
      name: "Dupont",
      query: "dupont statut:Terminé",
      statusGroup: "tous",
    });
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });

  it("affiche l'erreur renvoyée par la sauvegarde", async () => {
    saveSearchFormAction.mockResolvedValueOnce({
      ok: false,
      error: "Vous avez déjà une recherche portant ce nom.",
    } as never);
    renderSearches("dupont", "tous");
    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder la recherche" }));
    const dialog = modal("save-search-modal");

    fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(dialog.textContent).toContain("Vous avez déjà une recherche portant ce nom."),
    );
    expect(dialog.hasAttribute("open")).toBe(true);
  });
});

describe("SaveSearchLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("ne soumet pas le formulaire de recherche", () => {
    render(<SaveSearchLink />);

    expect(
      screen.getByRole("button", { name: "Sauvegarder la recherche" }).getAttribute("type"),
    ).toBe("button");
  });
});
