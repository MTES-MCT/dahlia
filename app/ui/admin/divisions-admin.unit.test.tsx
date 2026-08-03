import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { DivisionRowActions, DivisionsActionsProvider } from "./divisions-actions";
import type { DivisionListRow } from "@/app/lib/data/divisions";

vi.mock("@/app/(protected)/admin/divisions/actions", () => ({
  updateDivisionFormAction: vi.fn(async () => ({ ok: true })),
}));

const sampleDivision: DivisionListRow = {
  id: 2488,
  name: "1ère chambre",
  shortName: "1CH",
};

function mockDsfrModalApi() {
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

describe("DivisionRowActions", () => {
  beforeEach(() => {
    mockDsfrModalApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("ouvre la modale d'édition pré-remplie sans suppression", () => {
    render(
      <DivisionsActionsProvider>
        <DivisionRowActions division={sampleDivision} />
      </DivisionsActionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Modifier 1CH/ }));

    const dialog = document.getElementById("admin-edit-division-modal");
    expect(dialog?.classList.contains("fr-modal--opened")).toBe(true);
    expect(within(dialog as HTMLElement).getByDisplayValue("1CH")).toBeTruthy();
    expect(within(dialog as HTMLElement).getByDisplayValue("1ère chambre")).toBeTruthy();
    expect(within(dialog as HTMLElement).getByRole("button", { name: /Enregistrer/ })).toBeTruthy();
    expect(within(dialog as HTMLElement).queryByRole("button", { name: /Supprimer/ })).toBeNull();
  });
});
