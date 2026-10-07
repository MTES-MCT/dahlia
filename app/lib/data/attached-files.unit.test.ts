import { describe, it, expect } from "vitest";
import { piecesSearchForTests } from "@/app/lib/data/attached-files";

const caseFileKey = { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" };

describe("piecesSearchForTests.buildPiecesWhere", () => {
  it("filtre par texte libre sur les champs normalisés nom et type", () => {
    const where = piecesSearchForTests.buildPiecesWhere(caseFileKey, "memoire");

    expect(where).toEqual({
      AND: [
        { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" },
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
    const where = piecesSearchForTests.buildPiecesWhere(caseFileKey, 'nom:"requete introductive"');

    expect(where).toEqual({
      AND: [
        { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" },
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
    const where = piecesSearchForTests.buildPiecesWhere(caseFileKey, "type:memoire");

    expect(where).toEqual({
      AND: [
        { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" },
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
