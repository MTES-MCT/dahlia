import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchCaseFilePiecesTableData,
  piecesSearchForTests,
  type CaseFilePiece,
} from "@/app/lib/data/attached-files";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    attachedFile: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

const mockPiece = {
  encodedFileId: "ENC-1",
  originalFileName: "memoire.pdf",
  dahliaName: null,
  number: null,
  fileTypeLabel: "Mémoire en défense",
  fileFamilyTypeLabel: "Mémoire",
  fileFamilyType: { label: "Mémoire" },
  eventCreationDate: new Date("2026-01-10"),
} satisfies CaseFilePiece;

describe("piecesSearchForTests.buildPiecesWhere", () => {
  it("filtre par texte libre sur les champs normalisés nom et type", () => {
    const where = piecesSearchForTests.buildPiecesWhere("TA069-001", "memoire");

    expect(where).toEqual({
      AND: [
        { caseFileNumber: "TA069-001" },
        {
          OR: [
            { dahliaNameNormalized: { contains: "memoire" } },
            { originalFileNameNormalized: { contains: "memoire" } },
            { fileTypeLabelNormalized: { contains: "memoire" } },
            { fileFamilyTypeLabelNormalized: { contains: "memoire" } },
          ],
        },
      ],
    });
  });

  it("filtre par facette nom", () => {
    const where = piecesSearchForTests.buildPiecesWhere("TA069-001", 'nom:"requete introductive"');

    expect(where).toEqual({
      AND: [
        { caseFileNumber: "TA069-001" },
        {
          AND: [
            {
              OR: [
                { dahliaNameNormalized: { contains: "requete" } },
                { originalFileNameNormalized: { contains: "requete" } },
              ],
            },
            {
              OR: [
                { dahliaNameNormalized: { contains: "introductive" } },
                { originalFileNameNormalized: { contains: "introductive" } },
              ],
            },
          ],
        },
      ],
    });
  });

  it("filtre par facette type", () => {
    const where = piecesSearchForTests.buildPiecesWhere("TA069-001", "type:memoire");

    expect(where).toEqual({
      AND: [
        { caseFileNumber: "TA069-001" },
        {
          OR: [
            { fileTypeLabelNormalized: { contains: "memoire" } },
            { fileFamilyTypeLabelNormalized: { contains: "memoire" } },
          ],
        },
      ],
    });
  });
});

describe("fetchCaseFilePiecesTableData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne les lignes paginées et le total", async () => {
    vi.mocked(prisma.attachedFile.findMany).mockResolvedValue([mockPiece] as never);
    vi.mocked(prisma.attachedFile.count).mockResolvedValue(1);

    const result = await fetchCaseFilePiecesTableData("TA069-001", {});

    expect(result).toEqual({
      rows: [mockPiece],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
      pageSize: 10,
    });
  });
});
