import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { CreateUserButton } from "./create-user-button";
import { UserRowActions, UsersActionsProvider } from "./users-actions";
import type { UserListRow } from "@/app/lib/data/users";

vi.mock("@/app/(protected)/admin/users/actions", () => ({
  createUserFormAction: vi.fn(async () => ({ ok: true })),
  updateUserFormAction: vi.fn(async () => ({ ok: true })),
  deleteUserFormAction: vi.fn(async () => ({ ok: true })),
}));

const sampleUser: UserListRow = {
  id: "u1",
  firstName: "Alice",
  lastName: "Martin",
  email: "alice.martin@example.gouv.fr",
  isValidated: true,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
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

describe("CreateUserButton", () => {
  beforeEach(() => {
    mockDsfrModalApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le formulaire de création avec l'avertissement ProConnect", () => {
    render(<CreateUserButton />);

    // Modal content is mounted even while closed; assert the create form fields.
    const dialog = document.getElementById("admin-create-user-modal");
    expect(dialog).toBeTruthy();
    expect(within(dialog as HTMLElement).getByText(/ProConnect/)).toBeTruthy();
    expect(
      (within(dialog as HTMLElement).getByLabelText(/Email/) as HTMLInputElement).required,
    ).toBe(true);
    expect(within(dialog as HTMLElement).getByText("Créer")).toBeTruthy();
  });
});

describe("UserRowActions", () => {
  beforeEach(() => {
    mockDsfrModalApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("ouvre la modale d'édition pré-remplie", () => {
    render(
      <UsersActionsProvider>
        <UserRowActions user={sampleUser} />
      </UsersActionsProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Modifier alice\.martin@example\.gouv\.fr/ }),
    );

    const dialog = document.getElementById("admin-edit-user-modal");
    expect(dialog?.classList.contains("fr-modal--opened")).toBe(true);
    expect(
      within(dialog as HTMLElement).getByDisplayValue("alice.martin@example.gouv.fr"),
    ).toBeTruthy();
    expect(within(dialog as HTMLElement).getByDisplayValue("Alice")).toBeTruthy();
    expect(within(dialog as HTMLElement).getByDisplayValue("Martin")).toBeTruthy();
    expect(within(dialog as HTMLElement).getByRole("button", { name: /Enregistrer/ })).toBeTruthy();
  });

  it("ouvre la modale de confirmation de suppression", () => {
    render(
      <UsersActionsProvider>
        <UserRowActions user={sampleUser} />
      </UsersActionsProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Supprimer alice\.martin@example\.gouv\.fr/ }),
    );

    const dialog = document.getElementById("admin-delete-user-modal");
    expect(dialog?.classList.contains("fr-modal--opened")).toBe(true);
    expect(within(dialog as HTMLElement).getByText(/Confirmez-vous la suppression/)).toBeTruthy();
    expect(within(dialog as HTMLElement).getByText(/alice\.martin@example\.gouv\.fr/)).toBeTruthy();
    expect(within(dialog as HTMLElement).getByRole("button", { name: /^Supprimer$/ })).toBeTruthy();
  });
});
