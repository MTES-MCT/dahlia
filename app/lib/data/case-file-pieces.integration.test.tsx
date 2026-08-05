import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";

vi.mock("@/app/lib/prisma", async () => {
  const { testPrisma } = await import("@/data/test-support/integration-db");
  return { prisma: testPrisma };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/case_files/TA069-001",
  useSearchParams: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
  headers: vi.fn(async () => new Headers()),
}));

// Connected as an administrator: this suite is about the pièces workspace, not
// about the permission scope (see case-file-scope.integration.test.ts).
vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "admin-integration", isValidated: true, isAdmin: true },
      })),
    },
  },
}));

import { useSearchParams } from "next/navigation";
import {
  setupTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";
import { type CaseFileDetail } from "@/app/lib/data/case-files";
import { CaseFileTabs } from "@/app/ui/tabs/case-file-tabs";

const CASE_FILE_NUMBER = "TA069-001";

// The pièces workspace is rendered inside the case-file tab. It lists every
// pièce of the case file (no pagination, no search) in a sidebar.
function piecesSidebar() {
  return screen.getByRole("navigation", { name: "Liste des pièces" });
}

async function seedCaseFileWithPieces(): Promise<void> {
  await testPrisma.quality.create({ data: { code: "R", name: "Requérant" } });
  await testPrisma.legalEntityDivision.create({
    data: { id: 2488, name: "DDETS du Rhône", shortName: "DDETS69" },
  });
  await testPrisma.status.create({
    data: { id: 5, label: "En cours", category: "INSTRUCTION", groupId: 2 },
  });
  await testPrisma.actor.create({
    data: {
      id: 1001,
      actorType: "NATURAL_PERSON",
      firstName: "Jean",
      lastName: "Dupont",
    },
  });
  await testPrisma.caseFile.create({
    data: {
      caseFileNumber: CASE_FILE_NUMBER,
      title: "Recours DALO",
      type: "DALO",
      depositDate: new Date("2025-12-02T00:00:00Z"),
      assignedToLegalEntityDivisionId: 2488,
      lastStatusId: 5,
      lastStatusDate: new Date("2026-01-10T00:00:00Z"),
    },
  });
  await testPrisma.caseFileActor.create({
    data: {
      caseFileNumber: CASE_FILE_NUMBER,
      actorId: 1001,
      qualityCode: "R",
      isMainClaimant: true,
      isMainDefender: false,
    },
  });
  await testPrisma.measure.create({
    data: { code: "RECMEM", label: "Réception mémoire", type: "T", isImportant: false },
  });
  await testPrisma.caseFileEvent.create({
    data: {
      id: 90001,
      eventDate: new Date("2026-01-05T00:00:00Z"),
      caseFileNumber: CASE_FILE_NUMBER,
      measureCode: "RECMEM",
    },
  });
  await testPrisma.fileFamilyType.createMany({
    data: [
      { code: "REQ", label: "Requête" },
      { code: "MEM", label: "Mémoire" },
    ],
  });

  await testPrisma.attachedFile.createMany({
    data: [
      {
        encodedFileId: "ENC-REQ",
        originalFileName: "scan_requete.pdf",
        dahliaName: "Requête introductive",
        fileName: "scan_requete.pdf",
        mimeType: "application/pdf",
        documentType: "REQUETE",
        fileTypeLabel: "Requête",
        fileFamilyTypeLabel: "Requête",
        eventCreationDate: new Date("2026-01-15T00:00:00Z"),
        caseFileNumber: CASE_FILE_NUMBER,
        eventId: 90001,
        fileFamilyTypeCode: "REQ",
      },
      {
        encodedFileId: "ENC-MEM",
        originalFileName: "memoire.pdf",
        fileName: "memoire.pdf",
        mimeType: "application/pdf",
        documentType: "MEMOIRE",
        fileTypeLabel: "Document annexe",
        fileFamilyTypeLabel: "Mémoire",
        eventCreationDate: new Date("2026-01-05T00:00:00Z"),
        caseFileNumber: CASE_FILE_NUMBER,
        eventId: 90001,
        fileFamilyTypeCode: "MEM",
      },
    ],
  });
}

async function renderPiecesTab() {
  render(
    await CaseFileTabs({
      caseFile: {
        caseFileNumber: CASE_FILE_NUMBER,
        updatedAt: new Date(),
      } as NonNullable<CaseFileDetail>,
      tab: "pieces",
      searchParams: {},
    }),
  );
}

describe("case file pièces workspace (integration)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await seedCaseFileWithPieces();
    // The tab nav (a client component) reads the search params.
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("liste toutes les pièces du dossier chargées depuis la base", async () => {
    await renderPiecesTab();

    const sidebar = piecesSidebar();
    // DAHLIA name when set, otherwise the original file name.
    expect(within(sidebar).getByText("Requête introductive")).toBeTruthy();
    expect(within(sidebar).getByText("memoire.pdf")).toBeTruthy();

    // One "Tout sélectionner" checkbox plus one per pièce.
    expect(within(sidebar).getAllByRole("checkbox")).toHaveLength(3);
  });

  it("affiche la pièce la plus récente dans le panneau de détail", async () => {
    await renderPiecesTab();

    // ENC-REQ (15/01) is more recent than ENC-MEM (05/01) and comes first.
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });
});
