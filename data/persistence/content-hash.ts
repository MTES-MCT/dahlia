import { createHash } from "node:crypto";

// Produce a deterministic JSON string with object keys sorted recursively, so
// that two logically-equal payloads always serialize identically (regardless of
// key insertion order). Arrays keep their order — callers are expected to sort
// collections by a stable id beforehand when order is not significant.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

// SHA-256 fingerprint of an arbitrary payload, used to detect whether the data
// scraped for a case file changed between two runs.
export function computeContentHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
