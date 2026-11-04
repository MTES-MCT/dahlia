import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { SaveCurrentSearchButton, SavedSearchLabelRow, SavedSearches } from "./saved-searches";
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
    <SavedSearches
      searches={SEARCHES}
      currentQuery={currentQuery}
      currentGroup={currentGroup}
      sort={{ sortBy: "caseFileNumber" }}
    >
      <SavedSearchLabelRow />
      <SaveCurrentSearchButton />
    </SavedSearches>,
  );
}

function modal(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function applyButton() {
  return screen.queryByRole("button", { name: "Appliquer une recherche" });
}

function saveButton() {
  return screen.queryByRole("button", { name: "Sauvegarder la recherche courante" });
}

describe("SavedSearches", () => {
  beforeEach(() => {
    mockDsfrModalApi();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("propose d'appliquer une recherche sauvegardée quand aucune n'est appliquée", () => {
    renderSearches("dupont", "en_cours");

    expect(applyButton()?.className).toContain("fr-btn--secondary");
    expect(applyButton()?.className).toContain("fr-icon-arrow-left-right-line");
    expect(applyButton()?.closest("div")?.querySelector("p")?.textContent).toMatch(/^Recherche/u);
    expect(applyButton()?.closest("div")?.querySelector("p strong")).toBeNull();
    expect(screen.getByRole("button", { name: "Effacer les critères de recherche" })).toBeTruthy();
  });

  it("affiche le libellé Recherche sans recherche sauvegardée", () => {
    render(
      <SavedSearches searches={[]} currentQuery="" currentGroup="en_cours">
        <SavedSearchLabelRow />
      </SavedSearches>,
    );

    expect(applyButton()).toBeNull();
    const label = screen
      .getAllByText((content) => content.startsWith("Recherche"))
      .find((node) => node.tagName === "P");
    expect(label?.textContent?.trim()).toBe("Recherche\u00a0:");
  });

  it("liste les recherches dans la modale et applique celle choisie", () => {
    renderSearches("", "en_cours");

    fireEvent.click(applyButton() as HTMLElement);
    const dialog = modal("apply-saved-search-modal");
    expect(dialog.hasAttribute("open")).toBe(true);
    const radios = within(dialog).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((radio) => radio.checked)).toEqual([false, false]);
    // No danger zone while no saved search is applied.
    expect(within(dialog).queryByText("Zone de danger")).toBeNull();

    fireEvent.click(within(dialog).getByLabelText(/Dupont terminés/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Appliquer" }));

    expect(push).toHaveBeenCalledWith(
      "/case_files?sortBy=caseFileNumber&dahliaq=dupont&groupe=termine",
      { scroll: false },
    );
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("demande de choisir une recherche avant d'appliquer", () => {
    renderSearches("", "en_cours");
    fireEvent.click(applyButton() as HTMLElement);
    const dialog = modal("apply-saved-search-modal");

    fireEvent.click(within(dialog).getByRole("button", { name: "Appliquer" }));

    expect(dialog.textContent).toContain("Choisissez une recherche.");
    expect(push).not.toHaveBeenCalled();
  });

  it("remplace le bouton par le nom de la recherche et ses actions", () => {
    renderSearches("dupont", "termine");

    expect(applyButton()).toBeNull();
    const appliedLine = screen
      .getAllByText("Dupont terminés")
      .find((node) => node.closest("p")?.textContent?.startsWith("Recherche"));
    expect(appliedLine?.closest("p")?.textContent).toBe("Recherche\u00a0: Dupont terminés");
    const edit = screen.getByRole("button", { name: "Changer de recherche" });
    const clear = screen.getByRole("button", { name: "Effacer les critères de recherche" });
    expect(edit.className).toContain("fr-btn--secondary");
    expect(edit.className).toContain("fr-icon-arrow-left-right-line");
    expect(clear.className).toContain("fr-btn--tertiary");
    expect(clear.className).toContain("fr-icon-close-line");
  });

  it("efface tous les critères en restant dans l'onglet", () => {
    renderSearches("dupont", "termine");

    fireEvent.click(screen.getByRole("button", { name: "Effacer les critères de recherche" }));

    expect(push).toHaveBeenCalledWith("/case_files?sortBy=caseFileNumber&groupe=termine", {
      scroll: false,
    });
  });

  it("rouvre la modale sur la recherche pour en changer", () => {
    renderSearches("dupont", "termine");

    fireEvent.click(screen.getByRole("button", { name: "Changer de recherche" }));
    const dialog = modal("apply-saved-search-modal");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect((within(dialog).getByLabelText(/Dupont terminés/) as HTMLInputElement).checked).toBe(
      true,
    );

    fireEvent.click(within(dialog).getByLabelText(/Référés/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Appliquer" }));

    expect(push).toHaveBeenCalledWith(
      "/case_files?sortBy=caseFileNumber&dahliaq=recours%3AR%C3%A9f%C3%A9r%C3%A9&groupe=en_cours",
      { scroll: false },
    );
  });

  it("supprime la recherche depuis la zone de danger, après confirmation", async () => {
    renderSearches("dupont", "termine");
    fireEvent.click(screen.getByRole("button", { name: "Changer de recherche" }));
    const applyDialog = modal("apply-saved-search-modal");
    expect(within(applyDialog).getByText("Zone de danger")).toBeTruthy();

    fireEvent.click(within(applyDialog).getByRole("button", { name: "Supprimer cette recherche" }));

    const dialog = modal("delete-saved-search-modal");
    expect(applyDialog.hasAttribute("open")).toBe(false);
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain("Dupont terminés");
    expect(deleteSavedSearchFormAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(deleteSavedSearchFormAction).toHaveBeenCalledTimes(1));
    const [, formData] = deleteSavedSearchFormAction.mock.calls[0] as unknown as [null, FormData];
    expect(formData.get("id")).toBe("2");
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });

  it("propose à la suppression la recherche nouvellement cochée dans la modale", async () => {
    renderSearches("dupont", "termine");
    fireEvent.click(screen.getByRole("button", { name: "Changer de recherche" }));
    const applyDialog = modal("apply-saved-search-modal");

    fireEvent.click(within(applyDialog).getByLabelText(/Référés/));

    expect(
      within(applyDialog).getByText("Zone de danger").closest("section")?.textContent,
    ).toContain("Supprimer la recherche Référés.");

    fireEvent.click(within(applyDialog).getByRole("button", { name: "Supprimer cette recherche" }));
    const dialog = modal("delete-saved-search-modal");
    expect(dialog.textContent).toContain("Référés");
    expect(dialog.textContent).not.toContain("Dupont terminés");

    fireEvent.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(deleteSavedSearchFormAction).toHaveBeenCalledTimes(1));
    const [, formData] = deleteSavedSearchFormAction.mock.calls[0] as unknown as [null, FormData];
    expect(formData.get("id")).toBe("1");
  });

  it("n'efface rien quand on annule la suppression", () => {
    renderSearches("dupont", "termine");
    fireEvent.click(screen.getByRole("button", { name: "Changer de recherche" }));
    fireEvent.click(
      within(modal("apply-saved-search-modal")).getByRole("button", {
        name: "Supprimer cette recherche",
      }),
    );
    const dialog = modal("delete-saved-search-modal");

    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));

    expect(dialog.hasAttribute("open")).toBe(false);
    expect(deleteSavedSearchFormAction).not.toHaveBeenCalled();
  });

  it("affiche « Sauvegarder la recherche courante » en tertiaire via le contexte du formulaire", () => {
    renderSearches("dupont", "en_cours");

    const save = saveButton() as HTMLElement;
    expect(save.className).toContain("fr-btn--tertiary");
    expect(save.getAttribute("type")).toBe("button");
    expect(applyButton()?.nextElementSibling).not.toBe(save);
  });

  it("ne propose pas de sauvegarde quand une recherche sauvegardée est appliquée", () => {
    renderSearches("dupont", "termine");

    expect(saveButton()).toBeNull();
  });

  it("ne propose pas de sauvegarde sans recherche affichée", () => {
    renderSearches("", "en_cours");

    expect(saveButton()).toBeNull();
  });

  it("propose la sauvegarde même sans recherche déjà sauvegardée", () => {
    render(
      <SavedSearches searches={[]} currentQuery="dupont" currentGroup="en_cours">
        <SavedSearchLabelRow />
        <SaveCurrentSearchButton />
      </SavedSearches>,
    );

    expect(saveButton()).toBeTruthy();
    expect(applyButton()).toBeNull();
    expect(screen.getByRole("button", { name: "Effacer les critères de recherche" })).toBeTruthy();
  });

  it("sauvegarde la recherche affichée sous le nom saisi", async () => {
    renderSearches("dupont statut:Terminé", "tous");

    fireEvent.click(saveButton() as HTMLElement);

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
    fireEvent.click(saveButton() as HTMLElement);
    const dialog = modal("save-search-modal");

    fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(dialog.textContent).toContain("Vous avez déjà une recherche portant ce nom."),
    );
    expect(dialog.hasAttribute("open")).toBe(true);
  });
});
