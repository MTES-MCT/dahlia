import { describe, it, expect } from "vitest";
import {
  getFieldsToReview,
  getLastClassifierChangeAt,
  getQualificationReviewState,
} from "./case-file-qualification";

const EARLY = new Date("2026-10-01T10:00:00Z");
const LATE = new Date("2026-10-02T10:00:00Z");

describe("getQualificationReviewState", () => {
  it("asks for a review when the classifier changed a field after the validation", () => {
    expect(getQualificationReviewState(EARLY, LATE)).toBe("toReview");
  });

  it("asks for a review when classified fields were never validated", () => {
    expect(getQualificationReviewState(null, LATE)).toBe("toReview");
  });

  it("is validated when the validation follows the last classifier change", () => {
    expect(getQualificationReviewState(LATE, EARLY)).toBe("validated");
    expect(getQualificationReviewState(LATE, LATE)).toBe("validated");
  });

  it("is validated when there was never any classifier change", () => {
    expect(getQualificationReviewState(EARLY, null)).toBe("validated");
  });

  it("has nothing to review when never classified nor validated", () => {
    expect(getQualificationReviewState(null, null)).toBe("notReviewed");
  });
});

describe("getFieldsToReview", () => {
  const changes = [
    { field: "litigationType", changedAt: LATE },
    { field: "rightType", changedAt: EARLY },
  ];

  it("lists the fields changed by the classifier after the validation", () => {
    const between = new Date("2026-10-01T12:00:00Z");
    expect(getFieldsToReview(between, changes)).toEqual(["litigationType"]);
  });

  it("lists every classified field when the qualification was never validated", () => {
    expect(getFieldsToReview(null, changes)).toEqual(["litigationType", "rightType"]);
  });

  it("lists nothing once validated after every change", () => {
    expect(getFieldsToReview(LATE, changes)).toEqual([]);
  });

  it("ignores fields the classifier never wrote", () => {
    expect(getFieldsToReview(null, [{ field: "rightType", changedAt: EARLY }])).toEqual([
      "rightType",
    ]);
  });
});

describe("getLastClassifierChangeAt", () => {
  it("returns the most recent change, or null without any", () => {
    expect(
      getLastClassifierChangeAt([
        { field: "rightType", changedAt: EARLY },
        { field: "litigationType", changedAt: LATE },
      ]),
    ).toEqual(LATE);
    expect(getLastClassifierChangeAt([])).toBeNull();
  });
});
