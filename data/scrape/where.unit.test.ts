import { describe, expect, it } from "vitest";
import { divisionWhere, enrichmentTargetsWhere } from "./where";
import type { Args } from "./pipeline";

const args = (over: Partial<Args> = {}): Args => ({
  jurisdiction: "TA069",
  page: 0,
  size: 30,
  all: false,
  legalEntityDivisionIds: [],
  anonymize: true,
  skipEnrichment: false,
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

describe("enrichmentTargetsWhere", () => {
  it("excludes closed dossiers and soft-deleted ones", () => {
    expect(enrichmentTargetsWhere(args({ legalEntityDivisionIds: [2488] }))).toEqual({
      lastStatus: { label: { notIn: ["Terminé"] } },
      assignedToLegalEntityDivisionId: { in: [2488] },
      isDeleted: false,
    });
  });
});
