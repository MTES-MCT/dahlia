import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CaseFileTabs } from "./case-file-tabs";
import type { CaseFileDetail } from "@/app/lib/data/case-files";

// formatDateFr/getActorDisplayName live in the data-access module, which imports
// the Prisma client: mock it so importing the component does not instantiate one.
vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

// Minimal case file shaped like the detail payload; only the fields read by the
// component matter, the rest is filled to satisfy the type via the cast.
const caseFile = {
  caseFileNumber: "TA069-2026-001",
  title: "Dossier de test",
  type: "DALO",
  lastStatus: { label: "Inscrit au rôle d'une audience" },
  lastStatusDate: new Date("2026-05-01T10:00:00"),
  mainClaimant: { lastName: "Dupont", firstName: "Jean" },
  mainDefender: { legalPersonName: "Préfecture du Rhône" },
  creationDate: new Date("2026-01-10T10:00:00"),
  depositDate: new Date("2026-01-15T10:00:00"),
  estimatedHearingDate: null,
  chamber: { name: "1ère chambre" },
  assignedToLegalEntityDivision: { name: "DDETS du Rhône" },
  urgency: null,
  attachedFiles: [
    {
      encodedFileId: "f1",
      originalFileName: "requete.pdf",
      fileTypeLabel: "Requête",
      eventCreationDate: new Date("2026-01-15T10:00:00"),
      mimeType: "application/pdf",
    },
  ],
  events: [
    {
      id: 1,
      eventDate: new Date("2026-02-01T10:00:00"),
      measure: { label: "Enregistrement de la requête" },
      comment: "Commentaire de test",
      deadlineLabel: null,
    },
  ],
} as unknown as NonNullable<CaseFileDetail>;

describe("CaseFileTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche l'onglet Pièces par défaut", () => {
    render(<CaseFileTabs caseFile={caseFile} />);

    expect(screen.getByText("requete.pdf")).toBeTruthy();
    expect(screen.getByText("Requête")).toBeTruthy();
  });

  it("affiche le tableau des pièces au clic sur l'onglet Pièces", () => {
    render(<CaseFileTabs caseFile={caseFile} />);

    fireEvent.click(screen.getByRole("tab", { name: "Historique" }));
    fireEvent.click(screen.getByRole("tab", { name: "Pièces" }));

    expect(screen.getByText("requete.pdf")).toBeTruthy();
    expect(screen.getByText("Requête")).toBeTruthy();
  });

  it("affiche l'historique des événements au clic sur l'onglet Historique", () => {
    render(<CaseFileTabs caseFile={caseFile} />);

    fireEvent.click(screen.getByRole("tab", { name: "Historique" }));

    expect(screen.getByText("Enregistrement de la requête")).toBeTruthy();
    expect(screen.getByText("Commentaire de test")).toBeTruthy();
  });

  it("affiche le JSON brut au clic sur l'onglet Debug", () => {
    render(<CaseFileTabs caseFile={caseFile} />);

    fireEvent.click(screen.getByRole("tab", { name: "Debug" }));

    expect(screen.getByText(/"caseFileNumber": "TA069-2026-001"/)).toBeTruthy();
  });
});
