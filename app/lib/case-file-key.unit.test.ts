import { describe, expect, it } from "vitest";
import { caseFileHref, caseFileKeyFromParams, caseFileUniqueWhere } from "./case-file-key";

describe("caseFileHref", () => {
  it("construit l'URL du dossier à partir du tribunal et du numéro", () => {
    expect(caseFileHref({ jurisdictionCode: "TA069", caseFileNumber: "2401234" })).toBe(
      "/case_files/TA069/2401234",
    );
  });

  it("encode les segments et ajoute le suffixe tel quel", () => {
    expect(
      caseFileHref({ jurisdictionCode: "TA069", caseFileNumber: "TA069/1" }, "/pieces?tab=x"),
    ).toBe("/case_files/TA069/TA069%2F1/pieces?tab=x");
  });
});

describe("caseFileKeyFromParams", () => {
  it("décode les paramètres de la route", () => {
    expect(
      caseFileKeyFromParams({ jurisdictionCode: "TA069", caseFileNumber: "TA069%2F1" }),
    ).toEqual({ jurisdictionCode: "TA069", caseFileNumber: "TA069/1" });
  });
});

describe("caseFileUniqueWhere", () => {
  it("cible la clé composite Prisma du dossier", () => {
    expect(caseFileUniqueWhere({ jurisdictionCode: "TA034", caseFileNumber: "2401234" })).toEqual({
      jurisdictionCode_caseFileNumber: { jurisdictionCode: "TA034", caseFileNumber: "2401234" },
    });
  });
});
