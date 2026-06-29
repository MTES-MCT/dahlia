import { describe, it, expect } from "vitest";
import { queryTableRows } from "@/app/lib/table-query";
import { piecesQueryColumns, type PieceQueryData } from "@/app/lib/pieces-table";

const baseQuery = {
  sortBy: null,
  sortOrder: "descending" as const,
  page: 1,
  pageSize: 10,
};

const rows: PieceQueryData[] = [
  {
    originalFileName: "memoire.pdf",
    fileTypeLabel: "Mémoire en défense",
    fileFamilyType: { label: "Mémoire" },
    eventCreationDate: new Date("2026-01-10"),
  },
  {
    originalFileName: "requete.pdf",
    fileTypeLabel: "Requête",
    fileFamilyType: { label: "Requête" },
    eventCreationDate: new Date("2026-01-15"),
  },
];

describe("piecesQueryColumns nom filter", () => {
  const rowsWithDahliaName: PieceQueryData[] = [
    {
      originalFileName: "scan_001.pdf",
      dahliaName: "Requête introductive",
      fileTypeLabel: "Requête",
      eventCreationDate: new Date("2026-01-10"),
    },
    {
      originalFileName: "memoire.pdf",
      fileTypeLabel: "Mémoire",
      eventCreationDate: new Date("2026-01-15"),
    },
  ];

  it("cherche dans dahliaName via le texte libre", () => {
    const { totalCount, pageRows } = queryTableRows(rowsWithDahliaName, piecesQueryColumns, {
      ...baseQuery,
      query: "introductive",
    });
    expect(totalCount).toBe(1);
    expect(pageRows[0].originalFileName).toBe("scan_001.pdf");
  });

  it("filtre par facette nom sur dahliaName", () => {
    const { totalCount, pageRows } = queryTableRows(rowsWithDahliaName, piecesQueryColumns, {
      ...baseQuery,
      query: 'nom:"requete introductive"',
    });
    expect(totalCount).toBe(1);
    expect(pageRows[0].originalFileName).toBe("scan_001.pdf");
  });
});

describe("piecesQueryColumns type filter", () => {
  it("cherche dans fileFamilyType via le texte libre", () => {
    const { totalCount, pageRows } = queryTableRows(rows, piecesQueryColumns, {
      ...baseQuery,
      query: "memoire",
    });
    expect(totalCount).toBe(1);
    expect(pageRows[0].originalFileName).toBe("memoire.pdf");
  });

  it("filtre par facette type sur fileFamilyType", () => {
    const { totalCount, pageRows } = queryTableRows(rows, piecesQueryColumns, {
      ...baseQuery,
      query: "type:memoire",
    });
    expect(totalCount).toBe(1);
    expect(pageRows[0].originalFileName).toBe("memoire.pdf");
  });
});
