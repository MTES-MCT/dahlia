import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CaseFileTabs } from "./case-file-tabs";
import { fetchCaseFilePiecesFiltered, fetchCommentedPieces } from "@/app/lib/data/attached-files";
import { fetchCaseFileEventsTableData } from "@/app/lib/data/case-file-events";
import { fetchRelatedCaseFiles } from "@/app/lib/data/related-case-files";
import { fetchCaseFileDebugSnapshot, type CaseFileDetail } from "@/app/lib/data/case-files";
import type { CaseFilePiece } from "@/app/lib/data/attached-files";
import type { CaseFileEventsTableData } from "@/app/lib/data/case-file-events";
import type { CaseFileTabId } from "@/app/lib/case-file-tabs";

vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/app/lib/data/attached-files", () => ({
  fetchCaseFilePiecesFiltered: vi.fn(),
  fetchCommentedPieces: vi.fn(),
}));

vi.mock(
  "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/actions",
  () => ({
    savePieceMetadataAction: vi.fn(),
  }),
);

vi.mock("@/app/lib/data/related-case-files", () => ({
  fetchRelatedCaseFiles: vi.fn(),
}));

vi.mock("@/app/lib/data/case-file-events", () => ({
  fetchCaseFileEventsTableData: vi.fn(),
}));

vi.mock("@/app/lib/data/case-files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/data/case-files")>();
  return {
    ...actual,
    fetchCaseFileDebugSnapshot: vi.fn(),
  };
});

vi.mock("@/app/ui/button/refresh-case-file-button", () => ({
  RefreshCaseFileButton: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/case_files/TA069-2026-001",
  useSearchParams: () => new URLSearchParams(""),
}));

const pieces = [
  {
    encodedFileId: "f1",
    fileName: "requete.pdf",
    dahliaName: null,
    comment: null,
    isFavorite: false,
    mimeType: "application/pdf",
    fileTypeLabel: "Requête",
    fileFamilyTypeLabel: "Requête",
    fileFamilyType: { label: "Requête" },
    eventCreationDate: new Date("2026-01-15T10:00:00"),
  },
] satisfies CaseFilePiece[];

const historiqueTable = {
  rows: [
    {
      jurisdictionCode: "TA069",
      id: 1,
      subEventId: 0,
      eventDate: new Date("2026-02-01T10:00:00"),
      deadlineLabel: null,
      receiptDate: null,
      instructionClosingDate: null,
      comment: "Commentaire de test",
      commentSearchNormalized: null,
      deadlineLabelSearchNormalized: null,
      hasAttachment: false,
      generateAR: false,
      nbEventFile: 0,
      piecesNonDownloadable: null,
      relatedEventCount: 0,
      caseFileNumber: "TA069-2026-001",
      measureCode: "REQ",
      actorId: null,
      measure: {
        code: "REQ",
        label: "Enregistrement de la requête",
        type: "T",
        isImportant: false,
        family: null,
        labelNormalized: null,
      },
      actor: null,
    },
  ],
  totalCount: 1,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10,
} satisfies CaseFileEventsTableData;

type CaseFileDebugSnapshot = NonNullable<Awaited<ReturnType<typeof fetchCaseFileDebugSnapshot>>>;

const debugSnapshot = {
  caseFileNumber: "TA069-2026-001",
  title: "Dossier de test",
} as CaseFileDebugSnapshot;

const mockCaseFile = {
  caseFileNumber: "TA069-2026-001",
  updatedAt: new Date("2026-01-01T12:00:00"),
  caseFileActors: [],
  lastStatus: { label: "Jugé" },
  caseFileTags: [],
  classificationFieldChanges: [],
  qualificationValidatedAt: null,
  comment: null,
  _count: { events: 4, attachedFiles: 2 },
} as unknown as NonNullable<CaseFileDetail>;

const baseProps = {
  caseFile: mockCaseFile,
  searchParams: {},
};

async function renderCaseFileTabs(
  props: typeof baseProps & { tab: CaseFileTabId; isAdmin?: boolean },
) {
  render(await CaseFileTabs(props));
}

describe("CaseFileTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCaseFilePiecesFiltered).mockResolvedValue(pieces);
    vi.mocked(fetchRelatedCaseFiles).mockResolvedValue([]);
    vi.mocked(fetchCommentedPieces).mockResolvedValue([]);
    vi.mocked(fetchCaseFileEventsTableData).mockResolvedValue(historiqueTable);
    vi.mocked(fetchCaseFileDebugSnapshot).mockResolvedValue(debugSnapshot);
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le type de pièce dans le badge", async () => {
    vi.mocked(fetchCaseFilePiecesFiltered).mockResolvedValue([
      { ...pieces[0], fileFamilyTypeLabel: "Mémoire", fileTypeLabel: "Document annexe" },
    ]);

    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    expect(screen.getByText("Document annexe")).toBeTruthy();
    expect(screen.queryByText("Mémoire")).toBeNull();
  });

  it("n'affiche pas de badge quand le type de pièce est vide", async () => {
    vi.mocked(fetchCaseFilePiecesFiltered).mockResolvedValue([
      {
        ...pieces[0],
        fileFamilyTypeLabel: "Mémoire",
        fileTypeLabel: "",
      },
    ]);

    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    expect(screen.queryByText("Mémoire")).toBeNull();
  });

  it("affiche les onglets dans l'ordre Synthèse, Historique, Pièces avec leurs compteurs", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "synthese" });

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Synthèse", "Historique (4)", "Pièces (2)"]);
    expect(screen.getByRole("tab", { name: "Synthèse" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("charge les dossiers liés et les pièces commentées sur la synthèse", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "synthese" });

    expect(fetchRelatedCaseFiles).toHaveBeenCalledTimes(1);
    expect(fetchCommentedPieces).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Informations du dossier" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Qualification du dossier" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Commentaires" })).toBeTruthy();
    expect(fetchCaseFilePiecesFiltered).not.toHaveBeenCalled();
    expect(fetchCaseFileEventsTableData).not.toHaveBeenCalled();
    expect(fetchCaseFileDebugSnapshot).not.toHaveBeenCalled();
  });

  it("affiche les pièces quand tab=pieces", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    // Le nom apparaît dans la sidebar et dans le panneau de détail.
    expect(screen.getAllByText("requete.pdf").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Télécharger" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Éditer/ })).toBeTruthy();
  });

  it("affiche l'historique des événements quand tab=historique", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "historique" });

    expect(screen.getByText("Enregistrement de la requête")).toBeTruthy();
    expect(screen.getByText("Commentaire de test")).toBeTruthy();
  });

  it("affiche le JSON brut pour un administrateur quand tab=debug et le paramètre debug est présent", async () => {
    await renderCaseFileTabs({
      ...baseProps,
      tab: "debug",
      searchParams: { debug: "1" },
      isAdmin: true,
    });

    expect(screen.getByText(/"caseFileNumber": "TA069-2026-001"/)).toBeTruthy();
    expect(fetchCaseFileDebugSnapshot).toHaveBeenCalledTimes(1);
  });

  it("ne charge pas le dump debug pour un non-administrateur", async () => {
    await renderCaseFileTabs({
      ...baseProps,
      tab: "debug",
      searchParams: { debug: "1" },
      isAdmin: false,
    });

    expect(screen.queryByText(/"caseFileNumber": "TA069-2026-001"/)).toBeNull();
    expect(screen.queryByRole("tab", { name: "Debug" })).toBeNull();
    expect(fetchCaseFileDebugSnapshot).not.toHaveBeenCalled();
  });

  it("n'affiche pas l'onglet Debug sans le paramètre debug dans l'URL", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    expect(screen.queryByRole("tab", { name: "Debug" })).toBeNull();
  });

  it("ne charge que les données de l'onglet actif", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    expect(fetchCaseFilePiecesFiltered).toHaveBeenCalledTimes(1);
    expect(fetchRelatedCaseFiles).not.toHaveBeenCalled();
    expect(fetchCommentedPieces).not.toHaveBeenCalled();
    expect(fetchCaseFileEventsTableData).not.toHaveBeenCalled();
    expect(fetchCaseFileDebugSnapshot).not.toHaveBeenCalled();
  });
});
