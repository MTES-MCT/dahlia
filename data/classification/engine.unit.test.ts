import { describe, expect, it } from "vitest";
import { classify, hasClassification } from "./engine";
import type { ClassificationRule } from "./types";

const rules: readonly ClassificationRule[] = [
  {
    id: "specific",
    description: "test",
    pattern: /\bliquidation d astreinte\b/,
    litigationType: "LIQUIDATION_ASTREINTE",
    summary: "Liquidation d'astreinte",
  },
  {
    id: "generic",
    description: "test",
    pattern: /\bastreinte\b/,
    litigationType: "INJONCTION",
    summary: "Astreinte",
  },
  {
    id: "right",
    description: "test",
    pattern: /\bdalo\b/,
    rightType: "DALO",
  },
  {
    id: "decision-only",
    description: "test",
    fields: ["decision"],
    pattern: /\brejet\b/,
    summary: "Rejet",
  },
];

describe("classify", () => {
  it("returns nothing when no rule matches", () => {
    const result = classify({ title: "POLICE: Suspension permis de conduire" }, rules);
    expect(result).toEqual({ matches: [] });
    expect(hasClassification(result)).toBe(false);
  });

  it("applies the first matching rule per attribute", () => {
    const result = classify({ title: "DALO_Liquidation d'astreinte" }, rules);
    expect(result).toMatchObject({
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DALO",
      summary: "Liquidation d'astreinte",
    });
    // The generic rule also matches, but every attribute it provides is taken.
    expect(result.matches.map((match) => match.ruleId)).toEqual(["specific", "right"]);
  });

  it("reports which rule set which attribute, and on which field", () => {
    const result = classify({ title: "DALO liquidation d astreinte" }, rules);
    expect(result.matches).toEqual([
      { ruleId: "specific", field: "title", attributes: ["litigationType", "summary"] },
      { ruleId: "right", field: "title", attributes: ["rightType"] },
    ]);
  });

  it("matches rules against the decision field too", () => {
    const result = classify({ title: null, decision: "Ordonnance — rejet de la requête" }, rules);
    expect(result.summary).toBe("Rejet");
    expect(result.matches[0].field).toBe("decision");
  });

  it("ignores fields a rule is not scoped to", () => {
    const result = classify({ title: "rejet de la requête" }, rules);
    expect(result.summary).toBeUndefined();
  });

  it("falls back to the next field when the first one is empty", () => {
    const result = classify({ title: "", decision: "DALO" }, rules);
    expect(result.rightType).toBe("DALO");
    expect(result.matches[0].field).toBe("decision");
  });

  it("resolves summaries built from capture groups", () => {
    const result = classify({ title: "Référé suspension" }, [
      {
        id: "refere",
        description: "test",
        pattern: /\brefere\b( (liberte|suspension))?/,
        summary: (match) => (match[2] ? `Référé ${match[2]}` : "Référé"),
      },
    ]);
    expect(result.summary).toBe("Référé suspension");
  });
});
