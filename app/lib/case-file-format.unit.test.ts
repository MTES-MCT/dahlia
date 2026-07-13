import { describe, expect, it } from "vitest";
import { formatDateFr, formatDateInputValue } from "@/app/lib/case-file-format";

describe("formatDateInputValue", () => {
  it("retourne une chaîne vide quand la date est absente", () => {
    expect(formatDateInputValue(null)).toBe("");
    expect(formatDateInputValue(undefined)).toBe("");
  });

  it("formate une date au format yyyy-mm-dd", () => {
    expect(formatDateInputValue(new Date(2024, 2, 15))).toBe("2024-03-15");
  });

  it("ajoute un zéro devant le jour et le mois sur un chiffre", () => {
    expect(formatDateInputValue(new Date(2024, 0, 5))).toBe("2024-01-05");
  });
});

describe("formatDateFr", () => {
  it("retourne une chaîne vide quand la date est absente", () => {
    expect(formatDateFr(null)).toBe("");
    expect(formatDateFr(undefined)).toBe("");
  });

  it("formate une date au format dd/mm/yyyy", () => {
    expect(formatDateFr(new Date(2024, 2, 15))).toBe("15/03/2024");
  });

  it("ajoute un zéro devant le jour et le mois sur un chiffre", () => {
    expect(formatDateFr(new Date(2024, 0, 5))).toBe("05/01/2024");
  });
});
