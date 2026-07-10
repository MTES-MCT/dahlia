import { describe, expect, it } from "vitest";
import { computeContentHash } from "./content-hash";

describe("computeContentHash", () => {
  it("returns the same hash for equal payloads regardless of key order", () => {
    const a = computeContentHash({ id: 1, name: "x", nested: { b: 2, a: 1 } });
    const b = computeContentHash({ nested: { a: 1, b: 2 }, name: "x", id: 1 });
    expect(a).toBe(b);
  });

  it("returns a different hash when a value changes", () => {
    const a = computeContentHash({ id: 1, name: "x" });
    const b = computeContentHash({ id: 1, name: "y" });
    expect(a).not.toBe(b);
  });

  it("is sensitive to array order (callers sort collections beforehand)", () => {
    expect(computeContentHash([1, 2])).not.toBe(computeContentHash([2, 1]));
  });

  it("distinguishes a present null key from a missing key", () => {
    // Scraped payloads are parsed JSON, so values are null (never undefined):
    // the meaningful distinction is present-with-null vs absent.
    expect(computeContentHash({ a: null })).not.toBe(computeContentHash({}));
  });
});
