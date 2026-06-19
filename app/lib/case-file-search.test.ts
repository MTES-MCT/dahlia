import { describe, it, expect } from "vitest";
import { parseSearchQuery, serializeSearch, setFacet, getFacetValue } from "./case-file-search";

describe("case-file-search", () => {
  describe("serializeSearch", () => {
    it("renders free text alone", () => {
      expect(serializeSearch({ freeText: "dupont", facets: [] })).toBe("dupont");
    });

    it("renders a single facet", () => {
      expect(
        serializeSearch({ freeText: null, facets: [{ key: "requerant", value: "prefet" }] }),
      ).toBe("requerant:prefet");
    });

    it("quotes multi-word facet values", () => {
      expect(
        serializeSearch({ freeText: null, facets: [{ key: "requerant", value: "le prefet" }] }),
      ).toBe('requerant:"le prefet"');
    });

    it("combines free text and several facets", () => {
      expect(
        serializeSearch({
          freeText: "dupont",
          facets: [
            { key: "requerant", value: "prefet" },
            { key: "statut", value: "role" },
          ],
        }),
      ).toBe("dupont requerant:prefet statut:role");
    });

    it("round-trips through parseSearchQuery", () => {
      const query = 'dupont requerant:"le prefet" statut:role';
      expect(serializeSearch(parseSearchQuery(query))).toBe(query);
    });
  });

  describe("setFacet", () => {
    it("adds a facet to an empty query", () => {
      expect(setFacet("", "requerant", "prefet")).toBe("requerant:prefet");
    });

    it("adds a facet while keeping free text", () => {
      expect(setFacet("dupont", "requerant", "prefet")).toBe("dupont requerant:prefet");
    });

    it("replaces the existing facet of the same key", () => {
      expect(setFacet("requerant:martin", "requerant", "prefet")).toBe("requerant:prefet");
    });

    it("removes the facet when the value is empty", () => {
      expect(setFacet("dupont requerant:prefet", "requerant", "")).toBe("dupont");
    });

    it("removes the facet when the value is only whitespace", () => {
      expect(setFacet("requerant:prefet", "requerant", "   ")).toBe("");
    });

    it("leaves other facets untouched", () => {
      expect(setFacet("requerant:martin defendeur:dupont", "requerant", "prefet")).toBe(
        "defendeur:dupont requerant:prefet",
      );
    });

    it("quotes a multi-word value", () => {
      expect(setFacet("", "defendeur", "ville de lyon")).toBe('defendeur:"ville de lyon"');
    });

    it("trims the value before storing it", () => {
      expect(setFacet("", "requerant", "  prefet  ")).toBe("requerant:prefet");
    });
  });

  describe("getFacetValue", () => {
    it("returns the current value of a facet", () => {
      expect(getFacetValue("dupont requerant:prefet", "requerant")).toBe("prefet");
    });

    it("returns an empty string when the facet is absent", () => {
      expect(getFacetValue("dupont", "requerant")).toBe("");
    });

    it("reads a quoted multi-word value", () => {
      expect(getFacetValue('requerant:"le prefet"', "requerant")).toBe("le prefet");
    });
  });
});
