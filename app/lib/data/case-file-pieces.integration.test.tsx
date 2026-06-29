import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";

// Use the real Prisma client pointed at the dedicated `dahlia_test` database
// instead of the unit-test mock, so `fetchCaseFileDetail` runs its actual query
// (relations, snake_case mapping, generated columns) end to end.
vi.mock("@/app/lib/prisma", async () => {
  const { testPrisma } = await import("@/data/test-support/integration-db");
  return { prisma: testPrisma };
});

// The pièces table is a client component reading its state from the URL via
// next/navigation; stub it like the unit component test does.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/case_files/TA069-001",
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";
import {
  setupTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";
import { PIECES_PARAMS } from "@/app/lib/pieces-table";
import { CaseFileTabs } from "@/app/ui/case-file-tabs";

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

// Seed the minimal graph required to load a case file with two pièces:
// catalogs (quality, division, status, measure, file family), one actor, the
// case file, one event, and two attached files with distinct metadata so nom/type
// search can exercise dahliaName and fileFamilyType labels end to end.
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
        eventCreationDate: new Date("2026-01-05T00:00:00Z"),
        caseFileNumber: CASE_FILE_NUMBER,
        eventId: 90001,
        fileFamilyTypeCode: "MEM",
      },
    ],
  });
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
    const caseFile = await fetchCaseFileDetail(CASE_FILE_NUMBER);
    expect(caseFile).not.toBeNull();
    // The detail query returns both seeded pièces.
    expect(caseFile!.attachedFiles).toHaveLength(2);

    render(<CaseFileTabs caseFile={caseFile!} />);

    // Expected column headers of the pièces table.
    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headers.some((text) => text.includes("Nom"))).toBe(true);
    expect(headers.some((text) => text.includes("Type"))).toBe(true);
    expect(headers.some((text) => text.includes("Date"))).toBe(true);
  });

  it("affiche un contenu de ligne correct (nom, type, date)", async () => {
    const caseFile = await fetchCaseFileDetail(CASE_FILE_NUMBER);
    render(<CaseFileTabs caseFile={caseFile!} />);

    // Default sort is date descending, so the requête (15/01) comes first.
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // rows[0] is the header row.
    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole("cell");

    expect(cells[0].textContent).toContain("Requête introductive");
    expect(cells[0].textContent).toContain("scan_requete.pdf");
    expect(cells[1].textContent).toContain("Requête");
    expect(cells[2].textContent).toContain("15/01/2026");
  });

  it("filtre par texte libre sur dahliaName via ?pcq", async () => {
    setSearchParams(`${PIECES_PARAMS.query}=introductive`);
    const caseFile = await fetchCaseFileDetail(CASE_FILE_NUMBER);
    render(<CaseFileTabs caseFile={caseFile!} />);

    expectSinglePieceRow("Requête introductive");
  });

  it('filtre par facette nom sur dahliaName via ?pcq=nom:"…"', async () => {
    setSearchParams(`${PIECES_PARAMS.query}=nom:"requete introductive"`);
    const caseFile = await fetchCaseFileDetail(CASE_FILE_NUMBER);
    render(<CaseFileTabs caseFile={caseFile!} />);

    expectSinglePieceRow("Requête introductive");
  });

  it("filtre par texte libre sur fileFamilyType via ?pcq", async () => {
    setSearchParams(`${PIECES_PARAMS.query}=memoire`);
    const caseFile = await fetchCaseFileDetail(CASE_FILE_NUMBER);
    render(<CaseFileTabs caseFile={caseFile!} />);

    expectSinglePieceRow("memoire.pdf");
  });

  it("filtre par facette type sur fileFamilyType via ?pcq=type:…", async () => {
    setSearchParams(`${PIECES_PARAMS.query}=type:memoire`);
    const caseFile = await fetchCaseFileDetail(CASE_FILE_NUMBER);
    render(<CaseFileTabs caseFile={caseFile!} />);

    expectSinglePieceRow("memoire.pdf");
  });
});
