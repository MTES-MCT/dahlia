import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { CaseFileDetail } from "@/app/lib/data/case-files";
import {
  actorFixture,
  caseFileActorFixture,
} from "@/app/lib/test-support/case-file-actors.fixture";
import { CaseFileDetailsCard } from "./case-file-details-card";

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function caseFileFixture(
  overrides: Partial<NonNullable<CaseFileDetail>> = {},
): NonNullable<CaseFileDetail> {
  return {
    caseFileNumber: "TA069-2026-001",
    title: "Requête DALO",
    depositDate: new Date("2026-01-15T10:00:00.000Z"),
    lastStatus: { label: "En instruction" },
    caseFileActors: [
      caseFileActorFixture({
        actorId: 1,
        qualityCode: "R",
        isMainClaimant: true,
        isMainDefender: false,
        actor: actorFixture({ id: 1, firstName: "Jean", lastName: "Dupont" }),
        quality: { code: "R", name: "Requérant" },
      }),
      caseFileActorFixture({
        actorId: 2,
        qualityCode: "D",
        isMainClaimant: false,
        isMainDefender: true,
        actor: actorFixture({
          id: 2,
          actorType: "LEGAL_PERSON",
          legalPersonName: "Préfecture du Rhône",
          firstName: null,
          lastName: null,
        }),
        quality: { code: "D", name: "Défendeur" },
      }),
    ],
    chamber: { name: "3ème chambre" },
    caseFileTags: [],
    telerecoursSyncAt: new Date("2024-07-15T10:30:00Z"),
    ...overrides,
  } as NonNullable<CaseFileDetail>;
}

const TAG_OPTIONS = [
  { id: 1, label: "Urgent", color: "pink-tuile" },
  { id: 2, label: "À relancer", color: "green-menthe" },
];

function caseFileTagsFixture(tags: { id: number; label: string; color: string }[]) {
  return tags.map((tag) => ({ tag })) as NonNullable<CaseFileDetail>["caseFileTags"];
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

  it("affiche le nom d'affichage du dossier dans l'en-tête", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({
          litigationType: "INJONCTION",
          rightType: "DALO",
          summary: "Urgence familiale",
        })}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "TA069-2026-001 - Dupont Jean c/ Préfecture du Rhône - Injonction - DALO",
      }),
    ).toBeTruthy();
  });

  it("omet les segments non renseignés dans l'en-tête", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({
          title: null,
          litigationType: null,
          rightType: null,
          summary: null,
          caseFileActors: [],
        })}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "TA069-2026-001" })).toBeTruthy();
  });

  it("affiche le titre en sous-titre dans l'en-tête", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

    const subtitle = screen.getByText("Requête DALO");
    expect(subtitle.tagName).toBe("P");
    expect(subtitle.className).toContain("italic");
  });

  it("affiche le bouton d'édition et le statut dans l'en-tête", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

    expect(screen.getByText("En instruction")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Détails du dossier" })).toBeTruthy();
  });

  it("affiche la date de dernière synchronisation Télérecours sous le bouton d'édition", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

    expect(screen.getByText("Dernière synchronisation le 15/07/2024 à 12h30")).toBeTruthy();
  });

  it("affiche les tags du dossier dans l'en-tête", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({ caseFileTags: caseFileTagsFixture([TAG_OPTIONS[0]]) })}
      />,
    );

    const header = screen.getByRole("heading", { level: 1 }).closest("div") as HTMLElement;
    const tag = within(header.parentElement as HTMLElement).getByText("Urgent");

    expect(tag.className).toContain("fr-badge--pink-tuile");
  });

  it("n'affiche aucun tag quand le dossier n'en porte pas", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

    // "Urgent" only exists as a pickable option inside the modal, never as a
    // tag of the case file itself.
    const header = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    expect(within(header).queryByText("Urgent")).toBeNull();
  });

  it("propose le sélecteur de tags dans la modale", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

    const modal = screen.getByRole("dialog", { hidden: true });

    expect(within(modal).getByRole("combobox", { name: /Mots-clés/, hidden: true })).toBeTruthy();
  });

  it("n'affiche plus le champ résumé déprécié dans la modale", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({ summary: "Urgence familiale" })}
      />,
    );

    const modal = screen.getByRole("dialog", { hidden: true });

    expect(within(modal).queryByLabelText(/Quelques mots caractérisant le dossier/)).toBeNull();
    expect(within(modal).queryByText("Urgence familiale")).toBeNull();
  });

  it("affiche les métadonnées Télérecours dans la modale", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

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
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({ chamber: null, depositDate: null })}
      />,
    );

    const metadata = within(getModalMetadata());

    expect(metadata.getAllByText("—")).toHaveLength(2);
  });

  it("affiche la décision dans la modale quand elle est renseignée", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
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
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({ lastDecisionReading: null })}
      />,
    );

    const modal = screen.getByRole("dialog", { hidden: true });

    expect(within(modal).queryByRole("heading", { name: "Décision", hidden: true })).toBeNull();
  });

  it("affiche '-' pour les acteurs absents dans la modale", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({ caseFileActors: [] })}
      />,
    );

    const metadata = within(getModalMetadata());

    expect(metadata.getAllByText("-")).toHaveLength(2);
  });

  it("affiche les autres acteurs dans la modale quand ils existent", () => {
    render(
      <CaseFileDetailsCard
        availableTags={TAG_OPTIONS}
        caseFile={caseFileFixture({
          caseFileActors: [
            ...(caseFileFixture().caseFileActors ?? []),
            caseFileActorFixture({
              actorId: 3,
              qualityCode: "A",
              isMainClaimant: false,
              isMainDefender: false,
              actor: actorFixture({ id: 3, firstName: "Marie", lastName: "Martin" }),
              quality: { code: "A", name: "Avocat" },
            }),
          ],
        })}
      />,
    );

    const otherActors = within(getModalSection("Autres acteurs"));

    expect(otherActors.getByText(/Avocat/)).toBeTruthy();
    expect(otherActors.getByText("Martin Marie")).toBeTruthy();
  });

  it("masque la section autres acteurs quand seuls le requérant et le défendeur existent", () => {
    render(<CaseFileDetailsCard availableTags={TAG_OPTIONS} caseFile={caseFileFixture()} />);

    const modal = screen.getByRole("dialog", { hidden: true });

    expect(
      within(modal).queryByRole("heading", { name: "Autres acteurs", hidden: true }),
    ).toBeNull();
  });
});
