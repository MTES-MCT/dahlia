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
}));

import { useSearchParams } from "next/navigation";
import {
  setupTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";
import { type CaseFileDetail } from "@/app/lib/data/case-files";
import { PIECES_PARAMS } from "@/app/lib/pieces-table";
import { CaseFileTabs } from "@/app/ui/tabs/case-file-tabs";

const CASE_FILE_NUMBER = "TA069-001";

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

function getPieceTableDataRows() {
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  return rows.slice(1);
}

function expectSinglePieceRow(matchingText: string) {
  expect(screen.getByText("1 pièce")).toBeTruthy();
  const dataRows = getPieceTableDataRows();
  expect(dataRows).toHaveLength(1);
  expect(dataRows[0].textContent).toContain(matchingText);
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
      qualityCode: "R",
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
      mainClaimantId: 1001,
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

async function renderPiecesTab(query: string | null) {
  render(
    await CaseFileTabs({
      caseFile: {
        caseFileNumber: CASE_FILE_NUMBER,
        updatedAt: new Date(),
      } as NonNullable<CaseFileDetail>,
      tab: "pieces",
      searchParams: query ? { [PIECES_PARAMS.query]: query } : {},
    }),
  );
}

describe("case file pièces table (integration)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await seedCaseFileWithPieces();
    setSearchParams("");
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le tableau des pièces du dossier chargé depuis la base", async () => {
    await renderPiecesTab(null);

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headers.some((text) => text.includes("Nom"))).toBe(true);
    expect(headers.some((text) => text.includes("Type"))).toBe(true);
    expect(headers.some((text) => text.includes("Date"))).toBe(true);
    expect(screen.getByText("2 pièces")).toBeTruthy();
  });

  it("affiche un contenu de ligne correct (nom, type, date)", async () => {
    await renderPiecesTab(null);

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole("cell");

    // cells[0] is the leading selection checkbox column.
    expect(within(cells[0]).getByRole("checkbox")).toBeTruthy();
    expect(cells[1].textContent).toContain("Requête introductive");
    expect(cells[1].textContent).toContain("scan_requete.pdf");
    expect(cells[2].textContent).toContain("Requête");
    expect(cells[3].textContent).toContain("—");
    expect(cells[4].textContent).toContain("15/01/2026");
  });

  it("filtre par texte libre sur dahliaName via ?pcq", async () => {
    setSearchParams(`${PIECES_PARAMS.query}=introductive`);
    await renderPiecesTab("introductive");

    expectSinglePieceRow("Requête introductive");
  });

  it('filtre par facette nom sur dahliaName via ?pcq=nom:"…"', async () => {
    setSearchParams(`${PIECES_PARAMS.query}=nom:"requete introductive"`);
    await renderPiecesTab('nom:"requete introductive"');

    expectSinglePieceRow("Requête introductive");
  });

  it("filtre par texte libre sur fileFamilyType via ?pcq", async () => {
    setSearchParams(`${PIECES_PARAMS.query}=memoire`);
    await renderPiecesTab("memoire");

    expectSinglePieceRow("memoire.pdf");
  });

  it("filtre par facette type sur fileFamilyType via ?pcq=type:…", async () => {
    setSearchParams(`${PIECES_PARAMS.query}=type:memoire`);
    await renderPiecesTab("type:memoire");

    expectSinglePieceRow("memoire.pdf");
  });
});
