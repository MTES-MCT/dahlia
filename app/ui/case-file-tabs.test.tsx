import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CaseFileTabs } from "./case-file-tabs";
import type { CaseFileDetail } from "@/app/lib/data/case-files";

// formatDateFr/getActorDisplayName live in the data-access module, which imports
// the Prisma client: mock it so importing the component does not instantiate one.
vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

// The component (and the ClientTable / search bar / pagination it renders) reads
// the selected tab and each table's state from the URL via next/navigation.
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/case_files/TA069-2026-001",
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

// Drive the component's tab/table state by seeding the URL search params.
function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

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
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche l'onglet Pièces par défaut (aucun ?tab dans l'URL)", () => {
    render(<CaseFileTabs caseFile={caseFile} />);

    expect(screen.getByText("requete.pdf")).toBeTruthy();
    expect(screen.getByText("Requête")).toBeTruthy();
  });

  it("affiche l'historique des événements quand ?tab=historique", () => {
    setSearchParams("tab=historique");
    render(<CaseFileTabs caseFile={caseFile} />);

    expect(screen.getByText("Enregistrement de la requête")).toBeTruthy();
    expect(screen.getByText("Commentaire de test")).toBeTruthy();
  });

  it("affiche le JSON brut quand ?tab=debug", () => {
    setSearchParams("tab=debug");
    render(<CaseFileTabs caseFile={caseFile} />);

    expect(screen.getByText(/"caseFileNumber": "TA069-2026-001"/)).toBeTruthy();
  });

  it("navigue vers l'onglet sélectionné en mettant à jour ?tab au clic", () => {
    render(<CaseFileTabs caseFile={caseFile} />);

    fireEvent.click(screen.getByRole("tab", { name: "Historique" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("tab=historique");
  });

  it("conserve les autres paramètres d'URL au changement d'onglet", () => {
    setSearchParams("pcSort=nom&hiq=audience");
    render(<CaseFileTabs caseFile={caseFile} />);

    fireEvent.click(screen.getByRole("tab", { name: "Debug" }));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("tab=debug");
    expect(pushedUrl).toContain("pcSort=nom");
    expect(pushedUrl).toContain("hiq=audience");
  });
});
