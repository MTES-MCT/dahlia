import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { CaseFileDetail } from "@/app/lib/data/case-files";
import { CaseFileDetailsCard } from "./case-file-details-card";

function caseFileFixture(
  overrides: Partial<NonNullable<CaseFileDetail>> = {},
): NonNullable<CaseFileDetail> {
  return {
    caseFileNumber: "TA069-2026-001",
    title: "Requête DALO",
    depositDate: new Date("2026-01-15T10:00:00.000Z"),
    lastStatus: { label: "En instruction" },
    mainClaimant: {
      firstName: "Jean",
      lastName: "Dupont",
      legalPersonName: null,
      legalEntityName: null,
    },
    mainDefender: {
      legalPersonName: "Préfecture du Rhône",
      legalEntityName: null,
      firstName: null,
      lastName: null,
    },
    chamber: { name: "3ème chambre" },
    ...overrides,
  } as NonNullable<CaseFileDetail>;
}

function getModalMetadata() {
  const modal = screen.getByRole("dialog", { hidden: true });
  const heading = within(modal).getByRole("heading", {
    name: "Informations Télérecours",
    hidden: true,
  });
  return heading.nextElementSibling as HTMLElement;
}

describe("CaseFileDetailsCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le numéro de dossier et le titre dans l'en-tête", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "TA069-2026-001 - Requête DALO" }),
    ).toBeTruthy();
  });

  it("affiche uniquement le numéro de dossier quand le titre est absent", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture({ title: null })} />);

    expect(screen.getByRole("heading", { level: 1, name: "TA069-2026-001" })).toBeTruthy();
  });

  it("affiche le bouton d'édition et le statut dans l'en-tête", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    expect(screen.getByText("En instruction")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Éditer les détails du dossier" }),
    ).toBeTruthy();
  });

  it("affiche les métadonnées Télérecours dans la modale", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    const metadata = within(getModalMetadata());

    expect(metadata.getByText(/Requérant/)).toBeTruthy();
    expect(metadata.getByText("Dupont Jean")).toBeTruthy();
    expect(metadata.getByText(/Défendeur/)).toBeTruthy();
    expect(metadata.getByText("Préfecture du Rhône")).toBeTruthy();
    expect(metadata.getByText(/Date de réception/)).toBeTruthy();
    expect(metadata.getByText("15/01/2026")).toBeTruthy();
    expect(metadata.getByText(/Chambre/)).toBeTruthy();
    expect(metadata.getByText("3ème chambre")).toBeTruthy();
  });

  it("affiche des tirets pour la chambre et la date de réception absentes dans la modale", () => {
    render(
      <CaseFileDetailsCard caseFile={caseFileFixture({ chamber: null, depositDate: null })} />,
    );

    const metadata = within(getModalMetadata());

    expect(metadata.getAllByText("—")).toHaveLength(2);
  });

  it("affiche '-' pour les acteurs absents dans la modale", () => {
    render(
      <CaseFileDetailsCard
        caseFile={caseFileFixture({ mainClaimant: undefined, mainDefender: undefined })}
      />,
    );

    const metadata = within(getModalMetadata());

    expect(metadata.getAllByText("-")).toHaveLength(2);
  });
});
