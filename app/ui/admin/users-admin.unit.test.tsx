import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { CreateUserButton } from "./create-user-button";
import { UserRowActions, UsersActionsProvider } from "./users-actions";
import type { JurisdictionListRow } from "@/app/lib/data/jurisdictions";
import type { UserListRow } from "@/app/lib/data/users";

vi.mock("@/app/(protected)/admin/users/actions", () => ({
  createUserFormAction: vi.fn(async () => ({ ok: true })),
  updateUserFormAction: vi.fn(async () => ({ ok: true })),
  deleteUserFormAction: vi.fn(async () => ({ ok: true })),
}));

const sampleJurisdictions: JurisdictionListRow[] = [
  { id: 1, name: "Tribunal administratif de Lyon", shortName: "TA069" },
  { id: 2, name: "Tribunal administratif de Paris", shortName: "TA075" },
  { id: 3, name: "", shortName: "TA013" },
];

const sampleUser: UserListRow = {
  id: "u1",
  firstName: "Alice",
  lastName: "Martin",
  email: "alice.martin@example.gouv.fr",
  isValidated: true,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
  jurisdictions: [sampleJurisdictions[0], sampleJurisdictions[2]],
};

// Selected option labels of the permission scope list box.
function selectedJurisdictions(dialog: HTMLElement): string[] {
  const select = within(dialog).getByLabelText(/Juridictions/) as HTMLSelectElement;
  return [...select.selectedOptions].map((option) => option.textContent ?? "");
}

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
    render(<CreateUserButton jurisdictions={sampleJurisdictions} />);

    // Modal content is mounted even while closed; assert the create form fields.
    const dialog = document.getElementById("admin-create-user-modal");
    expect(dialog).toBeTruthy();
    expect(within(dialog as HTMLElement).getByText(/ProConnect/)).toBeTruthy();
    expect(
      (within(dialog as HTMLElement).getByLabelText(/Email/) as HTMLInputElement).required,
    ).toBe(true);
    expect(within(dialog as HTMLElement).getByText("Créer")).toBeTruthy();
  });

  it("propose les juridictions sans en présélectionner", () => {
    render(<CreateUserButton jurisdictions={sampleJurisdictions} />);

    const dialog = document.getElementById("admin-create-user-modal") as HTMLElement;
    const select = within(dialog).getByLabelText(/Juridictions/) as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    expect(select.name).toBe("jurisdictionIds");
    expect([...select.options].map((option) => option.value)).toEqual(["1", "2", "3"]);
    // A jurisdiction without a name falls back to its Télérecours code alone.
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "TA069 — Tribunal administratif de Lyon",
      "TA075 — Tribunal administratif de Paris",
      "TA013",
    ]);
    expect(selectedJurisdictions(dialog)).toEqual([]);
  });

  it("remplace la liste par un message quand aucune juridiction n'existe", () => {
    render(<CreateUserButton jurisdictions={[]} />);

    const dialog = document.getElementById("admin-create-user-modal") as HTMLElement;
    expect(within(dialog).queryByLabelText(/Juridictions/)).toBeNull();
    expect(within(dialog).getByText(/Aucune juridiction enregistrée/)).toBeTruthy();
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
      <UsersActionsProvider jurisdictions={sampleJurisdictions}>
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

  it("présélectionne le périmètre de droit de l'utilisateur", () => {
    render(
      <UsersActionsProvider jurisdictions={sampleJurisdictions}>
        <UserRowActions user={sampleUser} />
      </UsersActionsProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Modifier alice\.martin@example\.gouv\.fr/ }),
    );

    const dialog = document.getElementById("admin-edit-user-modal") as HTMLElement;
    expect(selectedJurisdictions(dialog)).toEqual([
      "TA069 — Tribunal administratif de Lyon",
      "TA013",
    ]);
  });

  it("ne présélectionne rien pour un utilisateur sans périmètre", () => {
    render(
      <UsersActionsProvider jurisdictions={sampleJurisdictions}>
        <UserRowActions user={{ ...sampleUser, jurisdictions: [] }} />
      </UsersActionsProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Modifier alice\.martin@example\.gouv\.fr/ }),
    );

    const dialog = document.getElementById("admin-edit-user-modal") as HTMLElement;
    expect(selectedJurisdictions(dialog)).toEqual([]);
  });

  it("ouvre la modale de confirmation de suppression", () => {
    render(
      <UsersActionsProvider jurisdictions={sampleJurisdictions}>
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
