import { describe, it, expect } from "vitest";
import { getQualificationReviewState } from "./case-file-qualification";

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
