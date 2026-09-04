import { describe, expect, it } from "vitest";
import { normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeText("Référé Liberté")).toBe("refere liberte");
  });

  it("collapses punctuation, underscores and separators into single spaces", () => {
    expect(normalizeText("DALO_Liquidation d'astreinte")).toBe("dalo liquidation d astreinte");
    expect(normalizeText("DALO - Liquidation d'astreintes")).toBe("dalo liquidation d astreintes");
    expect(normalizeText("DALO : absence de proposition d’hébergement.")).toBe(
      "dalo absence de proposition d hebergement",
    );
  });

  it("flattens multi-line titles", () => {
    expect(normalizeText("Logement DALO\r\nAbsence de proposition de logement")).toBe(
      "logement dalo absence de proposition de logement",
    );
  });

  it("keeps digits", () => {
    expect(normalizeText("Décision du 08/04/2025")).toBe("decision du 08 04 2025");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText("   ")).toBe("");
  });
});
