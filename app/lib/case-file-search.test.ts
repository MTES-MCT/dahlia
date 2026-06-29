import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  parseSearchQuery,
  serializeSearch,
  setFacet,
  getFacetValue,
} from "./case-file-search";

describe("case-file-search", () => {
  describe("normalizeForSearch", () => {
    it("supprime les diacritiques courants", () => {
      expect(normalizeForSearch("Café")).toBe("cafe");
      expect(normalizeForSearch("François")).toBe("francois");
      expect(normalizeForSearch("Müller")).toBe("muller");
    });

    it("met en minuscules", () => {
      expect(normalizeForSearch("DUPONT")).toBe("dupont");
    });

    it("laisse intacte une chaîne sans accents", () => {
      expect(normalizeForSearch("dupont")).toBe("dupont");
    });
  });

  describe("parseSearchQuery", () => {
    it("treats a plain query as free text without facets", () => {
      expect(parseSearchQuery("dupont")).toEqual({ freeText: "dupont", facets: [] });
    });

    it("extracts a single facet and restricts to its column", () => {
      expect(parseSearchQuery("requerant:prefet")).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "prefet" }],
      });
    });

    it("normalizes the facet key (case- and accent-insensitive)", () => {
      expect(parseSearchQuery("Requérant:prefet")).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "prefet" }],
      });
    });

    it("supports several facets combined together", () => {
      expect(parseSearchQuery("requerant:prefet defendeur:dupont")).toEqual({
        freeText: null,
        facets: [
          { key: "requerant", value: "prefet" },
          { key: "defendeur", value: "dupont" },
        ],
      });
    });

    it("keeps free text alongside facets", () => {
      expect(parseSearchQuery("prefet statut:cours")).toEqual({
        freeText: "prefet",
        facets: [{ key: "statut", value: "cours" }],
      });
    });

    it("keeps an unknown key as free text", () => {
      expect(parseSearchQuery("foo:bar")).toEqual({ freeText: "foo:bar", facets: [] });
    });

    it("keeps a key with an empty value as free text", () => {
      expect(parseSearchQuery("requerant:")).toEqual({ freeText: "requerant:", facets: [] });
    });

    it("treats a double-quoted segment as a single free-text token", () => {
      expect(parseSearchQuery('"jean dupont"')).toEqual({
        freeText: "jean dupont",
        facets: [],
      });
    });

    it("keeps quoted free text alongside unquoted tokens and facets", () => {
      expect(parseSearchQuery('prefet "jean dupont" statut:cours')).toEqual({
        freeText: "prefet jean dupont",
        facets: [{ key: "statut", value: "cours" }],
      });
    });

    it("supports quoted facet values containing spaces", () => {
      expect(parseSearchQuery('requerant:"jean dupont"')).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "jean dupont" }],
      });
    });

    it("treats a quoted key:value pair as literal free text", () => {
      expect(parseSearchQuery('"requerant:prefet"')).toEqual({
        freeText: "requerant:prefet",
        facets: [],
      });
    });
  });

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
