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
    caseFileActors: [
      {
        caseFileNumber: "TA069-2026-001",
        actorId: 1,
        qualityCode: "R",
        isMainClaimant: true,
        isMainDefender: false,
        actor: {
          id: 1,
          firstName: "Jean",
          lastName: "Dupont",
          legalPersonName: null,
          legalEntityName: null,
        },
        quality: { code: "R", name: "Requérant" },
      },
      {
        caseFileNumber: "TA069-2026-001",
        actorId: 2,
        qualityCode: "D",
        isMainClaimant: false,
        isMainDefender: true,
        actor: {
          id: 2,
          legalPersonName: "Préfecture du Rhône",
          legalEntityName: null,
          firstName: null,
          lastName: null,
        },
        quality: { code: "D", name: "Défendeur" },
      },
    ],
    chamber: { name: "3ème chambre" },
    ...overrides,
  } as NonNullable<CaseFileDetail>;
}

function getModalSection(name: string) {
  const modal = screen.getByRole("dialog", { hidden: true });
  const heading = within(modal).getByRole("heading", { name, hidden: true });
  return heading.nextElementSibling as HTMLElement;
}

function getModalMetadata() {
  return getModalSection("Informations Télérecours");
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
    expect(screen.getByRole("button", { name: "Détails du dossier" })).toBeTruthy();
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

  it("affiche la décision dans la modale quand elle est renseignée", () => {
    render(
      <CaseFileDetailsCard
        caseFile={caseFileFixture({
          lastDecisionReading: {
            caseFileNumber: "TA069-2026-001",
            readingDate: new Date("2025-07-14T22:00:00.000Z"),
            notificationDate: new Date("2025-07-15T00:00:00.000Z"),
            nature: "Jugement",
            operativePart: "Article 1er : La décision du 20 février 2024 est annulée.",
          },
        })}
      />,
    );

    const decision = within(getModalSection("Décision"));

    expect(decision.getByText(/Date et heure de la mise à disposition/)).toBeTruthy();
    expect(decision.getByText("Le 15/07/2025 à 00h00")).toBeTruthy();
    expect(decision.getByText(/Nature de la décision/)).toBeTruthy();
    expect(decision.getByText("Jugement")).toBeTruthy();
    expect(decision.getByText(/Dispositif/)).toBeTruthy();
    expect(
      decision.getByText("Article 1er : La décision du 20 février 2024 est annulée."),
    ).toBeTruthy();
  });

  it("masque la section décision quand aucune décision n'est renseignée", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture({ lastDecisionReading: null })} />);

    const modal = screen.getByRole("dialog", { hidden: true });

    expect(within(modal).queryByRole("heading", { name: "Décision", hidden: true })).toBeNull();
  });

  it("affiche '-' pour les acteurs absents dans la modale", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture({ caseFileActors: [] })} />);

    const metadata = within(getModalMetadata());

    expect(metadata.getAllByText("-")).toHaveLength(2);
  });
});
