import { describe, it, expect } from "vitest";
import { piecesSearchForTests } from "@/app/lib/data/attached-files";

describe("piecesSearchForTests.buildPiecesWhere", () => {
  it("filtre par texte libre sur les champs normalisés nom et type", () => {
    const where = piecesSearchForTests.buildPiecesWhere("TA069-001", "memoire");

    expect(where).toEqual({
      AND: [
        { caseFileNumber: "TA069-001" },
        {
          OR: [
            { dahliaNameNormalized: { contains: "memoire" } },
            { fileNameNormalized: { contains: "memoire" } },
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
                { fileNameNormalized: { contains: "requete" } },
              ],
            },
            {
              OR: [
                { dahliaNameNormalized: { contains: "introductive" } },
                { fileNameNormalized: { contains: "introductive" } },
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
