import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CaseFileTabs } from "./case-file-tabs";
import { fetchCaseFilePiecesTableData } from "@/app/lib/data/attached-files";
import { fetchCaseFileEventsTableData } from "@/app/lib/data/case-file-events";
import { fetchCaseFileDebugSnapshot, type CaseFileDetail } from "@/app/lib/data/case-files";
import type { CaseFilePiecesTableData } from "@/app/lib/data/attached-files";
import type { CaseFileEventsTableData } from "@/app/lib/data/case-file-events";

vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/app/lib/data/attached-files", () => ({
  fetchCaseFilePiecesTableData: vi.fn(),
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

const piecesTable = {
  rows: [
    {
      encodedFileId: "f1",
      originalFileName: "requete.pdf",
      dahliaName: null,
      number: null,
      fileTypeLabel: "Requête",
      fileFamilyTypeLabel: "Requête",
      fileFamilyType: { label: "Requête" },
      eventCreationDate: new Date("2026-01-15T10:00:00"),
    },
  ],
  totalCount: 1,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10,
} satisfies CaseFilePiecesTableData;

const historiqueTable = {
  rows: [
    {
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
} as NonNullable<CaseFileDetail>;

const baseProps = {
  caseFile: mockCaseFile,
  searchParams: {},
};

async function renderCaseFileTabs(
  props: typeof baseProps & { tab: "pieces" | "historique" | "debug" },
) {
  render(await CaseFileTabs(props));
}

describe("CaseFileTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCaseFilePiecesTableData).mockResolvedValue(piecesTable);
    vi.mocked(fetchCaseFileEventsTableData).mockResolvedValue(historiqueTable);
    vi.mocked(fetchCaseFileDebugSnapshot).mockResolvedValue(debugSnapshot);
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche l'onglet Pièces par défaut", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    expect(screen.getByText("requete.pdf")).toBeTruthy();
    expect(screen.getByText("Requête")).toBeTruthy();
  });

  it("affiche l'historique des événements quand tab=historique", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "historique" });

    expect(screen.getByText("Enregistrement de la requête")).toBeTruthy();
    expect(screen.getByText("Commentaire de test")).toBeTruthy();
  });

  it("affiche le JSON brut quand tab=debug", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "debug" });

    expect(screen.getByText(/"caseFileNumber": "TA069-2026-001"/)).toBeTruthy();
  });

  it("ne charge que les données de l'onglet actif", async () => {
    await renderCaseFileTabs({ ...baseProps, tab: "pieces" });

    expect(fetchCaseFilePiecesTableData).toHaveBeenCalledTimes(1);
    expect(fetchCaseFileEventsTableData).not.toHaveBeenCalled();
    expect(fetchCaseFileDebugSnapshot).not.toHaveBeenCalled();
  });
});
