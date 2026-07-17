import { describe, expect, it } from "vitest";
import {
  formatDateFr,
  formatDateInputValue,
  formatDateTimeFr,
  isDateInputBeforeToday,
} from "@/app/lib/case-file-format";

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

describe("formatDateTimeFr", () => {
  it("retourne une chaîne vide quand la date est absente", () => {
    expect(formatDateTimeFr(null)).toBe("");
    expect(formatDateTimeFr(undefined)).toBe("");
  });

  it("formate un instant UTC en date et heure de Paris", () => {
    expect(formatDateTimeFr(new Date("2025-07-14T22:00:00Z"))).toBe("15/07/2025 à 00h00");
  });

  it("applique l'heure d'hiver hors période d'été", () => {
    expect(formatDateTimeFr(new Date("2025-01-05T08:30:00Z"))).toBe("05/01/2025 à 09h30");
  });
});

describe("isDateInputBeforeToday", () => {
  it("retourne false pour une date vide", () => {
    expect(isDateInputBeforeToday("", "2026-07-17")).toBe(false);
  });

  it("retourne true pour une date antérieure à la référence", () => {
    expect(isDateInputBeforeToday("2026-07-16", "2026-07-17")).toBe(true);
  });

  it("retourne false pour la date du jour ou une date future", () => {
    expect(isDateInputBeforeToday("2026-07-17", "2026-07-17")).toBe(false);
    expect(isDateInputBeforeToday("2026-07-18", "2026-07-17")).toBe(false);
  });
});
