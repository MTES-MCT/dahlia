import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

describe("CaseFileDetailsCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le numéro de dossier et le titre dans l'en-tête", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "TA069-2026-001 - Requête DALO" }),
    ).toBeTruthy();
  });

  it("affiche uniquement le numéro de dossier quand le titre est absent", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture({ title: null })} />);

    expect(screen.getByRole("heading", { level: 2, name: "TA069-2026-001" })).toBeTruthy();
  });

  it("affiche le statut, les parties, la date de réception et la chambre", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    expect(screen.getByText("En instruction")).toBeTruthy();
    expect(screen.getByText(/Requérant/)).toBeTruthy();
    expect(screen.getByText("Dupont Jean")).toBeTruthy();
    expect(screen.getByText(/Défendeur/)).toBeTruthy();
    expect(screen.getByText("Préfecture du Rhône")).toBeTruthy();
    expect(screen.getByText(/Date de réception/)).toBeTruthy();
    expect(screen.getByText("15/01/2026")).toBeTruthy();
    expect(screen.getByText(/Chambre/)).toBeTruthy();
    expect(screen.getByText("3ème chambre")).toBeTruthy();
  });

  it("affiche des tirets pour la chambre et la date de réception absentes", () => {
    render(
      <CaseFileDetailsCard caseFile={caseFileFixture({ chamber: null, depositDate: null })} />,
    );

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("affiche '-' pour les acteurs absents", () => {
    render(
      <CaseFileDetailsCard
        caseFile={caseFileFixture({ mainClaimant: undefined, mainDefender: undefined })}
      />,
    );

    expect(screen.getAllByText("-")).toHaveLength(2);
  });
});
