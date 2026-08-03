import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import {
  JurisdictionRowActions,
  JurisdictionsActionsProvider,
} from "./jurisdictions-actions";
import type { JurisdictionListRow } from "@/app/lib/data/jurisdictions";

vi.mock("@/app/(protected)/admin/jurisdiction/actions", () => ({
  updateJurisdictionFormAction: vi.fn(async () => ({ ok: true })),
}));

const sampleJurisdiction: JurisdictionListRow = {
  id: 1,
  name: "Tribunal administratif de Lyon",
  shortName: "TA069",
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

describe("JurisdictionRowActions", () => {
  beforeEach(() => {
    mockDsfrModalApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("ouvre la modale d'édition pré-remplie sans suppression", () => {
    render(
      <JurisdictionsActionsProvider>
        <JurisdictionRowActions jurisdiction={sampleJurisdiction} />
      </JurisdictionsActionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Modifier TA069/ }));

    const dialog = document.getElementById("admin-edit-jurisdiction-modal");
    expect(dialog?.classList.contains("fr-modal--opened")).toBe(true);
    expect(within(dialog as HTMLElement).getByDisplayValue("TA069")).toBeTruthy();
    expect(
      within(dialog as HTMLElement).getByDisplayValue("Tribunal administratif de Lyon"),
    ).toBeTruthy();
    expect(within(dialog as HTMLElement).getByRole("button", { name: /Enregistrer/ })).toBeTruthy();
    expect(within(dialog as HTMLElement).queryByRole("button", { name: /Supprimer/ })).toBeNull();
  });
});
