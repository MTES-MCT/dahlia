import { describe, expect, it } from "vitest";
import { divisionWhere, scrapedPerimeterWhere } from "./where";
import type { Args } from "./pipeline";

const args = (over: Partial<Args> = {}): Args => ({
  jurisdiction: "TA069",
  page: 0,
  size: 30,
  all: false,
  legalEntityDivisionIds: [],
  anonymize: true,
  enrich: "ongoing",
  updatePieceNumbers: false,
  classify: false,
  classifyOverwrite: false,
  ...over,
});

describe("divisionWhere", () => {
  it("omits the filter entirely when no division is configured", () => {
    expect(divisionWhere(args())).toEqual({});
  });
  it("builds an `in` filter when divisions are configured", () => {
    expect(divisionWhere(args({ legalEntityDivisionIds: [1, 2] }))).toEqual({
      assignedToLegalEntityDivisionId: { in: [1, 2] },
    });
  });
});

describe("scrapedPerimeterWhere", () => {
  it("excludes closed dossiers and soft-deleted ones, scoped to the jurisdiction", () => {
    expect(scrapedPerimeterWhere(args({ legalEntityDivisionIds: [2488] }), true)).toEqual({
      lastStatus: { label: { notIn: ["Terminé"] } },
      assignedToLegalEntityDivisionId: { in: [2488] },
      jurisdiction: { shortName: "TA069" },
      isDeleted: false,
    });
  });

  it("keeps the jurisdiction filter when no division is configured", () => {
    expect(scrapedPerimeterWhere(args({ jurisdiction: "TA069bis" }), true)).toEqual({
      lastStatus: { label: { notIn: ["Terminé"] } },
      jurisdiction: { shortName: "TA069bis" },
      isDeleted: false,
    });
  });

  it("drops the status exclusion when closed dossiers are included", () => {
    expect(scrapedPerimeterWhere(args({ legalEntityDivisionIds: [2488] }), false)).toEqual({
      assignedToLegalEntityDivisionId: { in: [2488] },
      jurisdiction: { shortName: "TA069" },
      isDeleted: false,
    });
  });
});
