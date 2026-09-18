import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent, waitFor } from "@testing-library/react";
import { CreateTagButton } from "./create-tag-button";
import { TagRowActions, TagsActionsProvider } from "./tags-actions";
import type { TagListRow } from "@/app/lib/data/tags";

const listTagCaseFilesAction = vi.fn(async () => ({
  ok: true as const,
  caseFiles: [
    { caseFileNumber: "TA069/1", displayName: "TA069/1 - Dupont c/ Préfet" },
    { caseFileNumber: "TA069/2", displayName: "TA069/2 - Martin c/ Préfet" },
  ],
}));

vi.mock("@/app/(protected)/admin/tags/actions", () => ({
  createTagFormAction: vi.fn(async () => ({ ok: true })),
  updateTagFormAction: vi.fn(async () => ({ ok: true })),
  deleteTagFormAction: vi.fn(async () => ({ ok: true })),
  listTagCaseFilesAction: (...args: unknown[]) => listTagCaseFilesAction(...(args as [])),
}));

const unusedTag: TagListRow = {
  id: 1,
  label: "Urgent",
  color: "pink-tuile",
  caseFileCount: 0,
};

const usedTag: TagListRow = {
  id: 2,
  label: "À relancer",
  color: "green-menthe",
  caseFileCount: 2,
};

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
        element.setAttribute("aria-modal", "true");
        element.classList.add("fr-modal--opened");
      },
      conceal: () => {
        element.removeAttribute("open");
        element.removeAttribute("aria-modal");
        element.classList.remove("fr-modal--opened");
      },
    },
  });
}

function renderRow(tag: TagListRow) {
  return render(
    <TagsActionsProvider>
      <TagRowActions tag={tag} />
    </TagsActionsProvider>,
  );
}

function modal(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

describe("CreateTagButton", () => {
  beforeEach(() => {
    mockDsfrModalApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("expose le libellé et la couleur dans le formulaire de création", () => {
    render(<CreateTagButton />);

    const dialog = modal("admin-create-tag-modal");
    expect(within(dialog).getByLabelText(/Libellé/)).toBeTruthy();
    expect(within(dialog).getByLabelText(/Couleur/)).toBeTruthy();
    expect(within(dialog).getByText("Créer")).toBeTruthy();
  });
});

describe("TagRowActions", () => {
  beforeEach(() => {
    mockDsfrModalApi();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("préremplit le formulaire d'édition avec le tag sélectionné", () => {
    renderRow(unusedTag);

    fireEvent.click(screen.getByRole("button", { name: "Modifier le tag Urgent" }));

    const dialog = modal("admin-edit-tag-modal");
    expect((within(dialog).getByLabelText(/Libellé/) as HTMLInputElement).value).toBe("Urgent");
    expect((within(dialog).getByLabelText(/Couleur/) as HTMLSelectElement).value).toBe(
      "pink-tuile",
    );
  });

  describe("suppression d'un tag inutilisé", () => {
    it("ouvre la modale de confirmation", () => {
      renderRow(unusedTag);

      fireEvent.click(screen.getByRole("button", { name: "Supprimer le tag Urgent" }));

      const dialog = modal("admin-delete-tag-modal");
      expect(within(dialog).getByText(/Confirmez-vous la suppression/)).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Supprimer" })).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeTruthy();
      expect(listTagCaseFilesAction).not.toHaveBeenCalled();
    });

    // The buttons sit outside the form and target it through the `form` attribute.
    it("relie le bouton Supprimer au formulaire caché", () => {
      renderRow(unusedTag);

      fireEvent.click(screen.getByRole("button", { name: "Supprimer le tag Urgent" }));

      const dialog = modal("admin-delete-tag-modal");
      const submit = within(dialog).getByRole("button", { name: "Supprimer" });
      expect(submit.getAttribute("form")).toBe("admin-delete-tag-form");
      const form = dialog.querySelector("#admin-delete-tag-form") as HTMLFormElement;
      expect(form.querySelector('input[name="id"]')?.getAttribute("value")).toBe("1");
    });
  });

  describe("suppression d'un tag utilisé", () => {
    it("ouvre la modale de blocage plutôt que la confirmation", async () => {
      renderRow(usedTag);

      fireEvent.click(screen.getByRole("button", { name: "Supprimer le tag À relancer" }));

      const dialog = modal("admin-tag-in-use-modal");
      expect(within(dialog).getByText(/ne peut pas être supprimé/)).toBeTruthy();
      // The count is split across text nodes by the <strong> wrapper.
      expect(dialog.textContent).toContain("2 dossiers");
      // No way to force the deletion from this modal.
      expect(within(dialog).queryByRole("button", { name: "Supprimer" })).toBeNull();
      // DSFR renders its own "Fermer" control in the modal header, so there is
      // more than one: assert ours is present rather than unique.
      expect(within(dialog).getAllByRole("button", { name: "Fermer" }).length).toBeGreaterThan(0);
    });

    it("liste les dossiers concernés avec un lien vers un nouvel onglet", async () => {
      renderRow(usedTag);

      fireEvent.click(screen.getByRole("button", { name: "Supprimer le tag À relancer" }));

      const dialog = modal("admin-tag-in-use-modal");

      await waitFor(() => {
        expect(within(dialog).getByText(/TA069\/1 - Dupont/)).toBeTruthy();
      });

      const link = within(dialog).getByRole("link", { name: /TA069\/1 - Dupont/ });
      expect(link.getAttribute("href")).toBe("/case_files/TA069%2F1");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");

      expect(listTagCaseFilesAction).toHaveBeenCalledWith(2);
    });
  });
});
