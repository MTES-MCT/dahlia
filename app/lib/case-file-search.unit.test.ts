import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  parseSearchQuery,
  serializeSearch,
  setFacet,
  setFacetValues,
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
      expect(parseSearchQuery("prefet titre:cours")).toEqual({
        freeText: "prefet",
        facets: [{ key: "titre", value: "cours" }],
      });
    });

    it("keeps an unknown key as free text", () => {
      expect(parseSearchQuery("foo:bar")).toEqual({ freeText: "foo:bar", facets: [] });
    });

    it("keeps a key with an empty value as free text", () => {
      expect(parseSearchQuery("dossier:")).toEqual({ freeText: "dossier:", facets: [] });
    });

    it("treats a double-quoted segment as a single free-text token", () => {
      expect(parseSearchQuery('"jean dupont"')).toEqual({
        freeText: "jean dupont",
        facets: [],
      });
    });

    it("keeps quoted free text alongside unquoted tokens and facets", () => {
      expect(parseSearchQuery('prefet "jean dupont" titre:cours')).toEqual({
        freeText: "prefet jean dupont",
        facets: [{ key: "titre", value: "cours" }],
      });
    });

    it("supports quoted facet values containing spaces", () => {
      expect(parseSearchQuery('requerant:"jean dupont"')).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "jean dupont" }],
      });
    });

    it("treats a quoted key:value pair as literal free text", () => {
      expect(parseSearchQuery('"dossier:TA069"')).toEqual({
        freeText: "dossier:TA069",
        facets: [],
      });
    });

    it("extracts dossier facets separately from other dossier fields", () => {
      expect(parseSearchQuery("dossier:TA069 requerant:prefet titre:dupont")).toEqual({
        freeText: null,
        facets: [
          { key: "dossier", value: "TA069" },
          { key: "requerant", value: "prefet" },
          { key: "titre", value: "dupont" },
        ],
      });
    });
  });

  describe("serializeSearch", () => {
    it("renders free text alone", () => {
      expect(serializeSearch({ freeText: "dupont", facets: [] })).toBe("dupont");
    });

    it("renders a single facet", () => {
      expect(
        serializeSearch({ freeText: null, facets: [{ key: "dossier", value: "TA069" }] }),
      ).toBe("dossier:TA069");
    });

    it("quotes multi-word facet values", () => {
      expect(
        serializeSearch({ freeText: null, facets: [{ key: "dossier", value: "le prefet" }] }),
      ).toBe('dossier:"le prefet"');
    });

    it("combines free text and several facets", () => {
      expect(
        serializeSearch({
          freeText: "dupont",
          facets: [
            { key: "requerant", value: "prefet" },
            { key: "titre", value: "dalo" },
          ],
        }),
      ).toBe("dupont requerant:prefet titre:dalo");
    });

    it("round-trips through parseSearchQuery", () => {
      const query = 'dupont requerant:"le prefet" titre:dalo';
      expect(serializeSearch(parseSearchQuery(query))).toBe(query);
    });
  });

  describe("setFacetValues", () => {
    it("applies several facets in one pass", () => {
      expect(
        setFacetValues("", {
          dossier: "TA069",
          requerant: "prefet",
          titre: "",
        }),
      ).toBe("dossier:TA069 requerant:prefet");
    });

    it("replaces existing facets for the updated keys only", () => {
      expect(
        setFacetValues("dossier:TA068 requerant:martin defendeur:dupont", {
          dossier: "TA069",
          requerant: "prefet",
        }),
      ).toBe("defendeur:dupont dossier:TA069 requerant:prefet");
    });
  });

  describe("setFacet", () => {
    it("adds a facet to an empty query", () => {
      expect(setFacet("", "dossier", "TA069")).toBe("dossier:TA069");
    });

    it("adds a facet while keeping free text", () => {
      expect(setFacet("dupont", "dossier", "TA069")).toBe("dupont dossier:TA069");
    });

    it("replaces the existing facet of the same key", () => {
      expect(setFacet("dossier:TA068", "dossier", "TA069")).toBe("dossier:TA069");
    });

    it("removes the facet when the value is empty", () => {
      expect(setFacet("dupont dossier:TA069", "dossier", "")).toBe("dupont");
    });

    it("removes the facet when the value is only whitespace", () => {
      expect(setFacet("dossier:TA069", "dossier", "   ")).toBe("");
    });

    it("leaves other facets untouched", () => {
      expect(setFacet("dossier:TA068 defendeur:dupont", "dossier", "TA069")).toBe(
        "defendeur:dupont dossier:TA069",
      );
    });

    it("quotes a multi-word value", () => {
      expect(setFacet("", "defendeur", "ville de lyon")).toBe('defendeur:"ville de lyon"');
    });

    it("trims the value before storing it", () => {
      expect(setFacet("", "dossier", "  TA069  ")).toBe("dossier:TA069");
    });
  });

  describe("getFacetValue", () => {
    it("returns the current value of a facet", () => {
      expect(getFacetValue("dupont dossier:TA069", "dossier")).toBe("TA069");
    });

    it("returns an empty string when the facet is absent", () => {
      expect(getFacetValue("dupont", "dossier")).toBe("");
    });

    it("reads a quoted multi-word value", () => {
      expect(getFacetValue('dossier:"le prefet"', "dossier")).toBe("le prefet");
    });
  });
});
