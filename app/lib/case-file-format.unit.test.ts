import { describe, expect, it } from "vitest";
import {
  getCaseFileDisplayName,
  formatDateFr,
  formatDateInputValue,
  formatDateTimeFr,
  isDateInputBeforeToday,
} from "@/app/lib/case-file-format";
import { caseFileWithActor } from "@/app/lib/test-support/case-file-actors.fixture";

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

describe("getCaseFileDisplayName", () => {
  it("formate le nom complet avec résumé", () => {
    expect(getCaseFileDisplayName(caseFileWithActor())).toBe(
      "TA069-2026-001 - Dupont Jean - Injonction - DALO (Urgence familiale)",
    );
  });

  it("affiche requérant vs défendeur quand les deux sont renseignés", () => {
    expect(
      getCaseFileDisplayName(
        caseFileWithActor(
          {},
          {
            defender: {
              actorType: "LEGAL_PERSON",
              legalPersonName: "Préfecture du Rhône",
            },
          },
        ),
      ),
    ).toBe(
      "TA069-2026-001 - Dupont Jean vs Préfecture du Rhône - Injonction - DALO (Urgence familiale)",
    );
  });

  it("omet le résumé entre parenthèses quand il est absent", () => {
    expect(getCaseFileDisplayName(caseFileWithActor({ summary: null }))).toBe(
      "TA069-2026-001 - Dupont Jean - Injonction - DALO",
    );
  });

  it("omet les segments non renseignés", () => {
    expect(
      getCaseFileDisplayName(
        caseFileWithActor(
          {
            title: null,
            litigationType: null,
            rightType: null,
            summary: null,
          },
          { claimant: null },
        ),
      ),
    ).toBe("TA069-2026-001");
  });
});
