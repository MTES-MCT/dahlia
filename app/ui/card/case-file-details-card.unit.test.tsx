import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

describe("CaseFileDetailsCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche « Dossier » suivi du nom d'affichage en titre de la page", () => {
    render(
      <CaseFileDetailsCard
        caseFile={caseFileFixture({
          litigationType: "INJONCTION",
          rightType: "DALO",
          summary: "Urgence familiale",
        })}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Dossier TA069-2026-001 - Dupont Jean c/ Préfecture du Rhône - Injonction - DALO",
    });
    expect(heading.className).toContain("fr-h3");
  });

  it("omet les segments non renseignés dans l'en-tête", () => {
    render(
      <CaseFileDetailsCard
        caseFile={caseFileFixture({
          title: null,
          litigationType: null,
          rightType: null,
          summary: null,
          caseFileActors: [],
        })}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Dossier TA069-2026-001" })).toBeTruthy();
  });

  it("affiche le titre Télérecours en sous-titre dans l'en-tête", () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    const subtitle = screen.getByText("Requête DALO");
    expect(subtitle.tagName).toBe("P");
    expect(subtitle.className).toContain("italic");
  });

  it("affiche le statut, puis la synchronisation Télérecours en dessous", async () => {
    render(<CaseFileDetailsCard caseFile={caseFileFixture()} />);

    const status = screen.getByText("En instruction");
    // The sync notice replaces the date while the on-mount sync runs.
    const sync = await screen.findByText("Dernière synchronisation le 15/07/2024 à 12h30");
    expect(status.compareDocumentPosition(sync) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("n'affiche ni bouton « Détails du dossier », ni modale, ni tags", () => {
    render(
      <CaseFileDetailsCard
        caseFile={caseFileFixture({
          caseFileTags: [{ tag: { id: 1, label: "Urgent", color: "pink-tuile" } }],
        } as Partial<NonNullable<CaseFileDetail>>)}
      />,
    );

    expect(screen.queryByRole("button", { name: "Détails du dossier" })).toBeNull();
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(screen.queryByText("Urgent")).toBeNull();
    expect(screen.queryByRole("list", { name: "Tags du dossier" })).toBeNull();
  });
});
