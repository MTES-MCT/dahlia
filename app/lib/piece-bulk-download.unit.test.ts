import { describe, expect, it } from "vitest";
import { normalizePieceDownloadIds } from "@/app/lib/piece-bulk-download";

describe("normalizePieceDownloadIds", () => {
  it("preserves order and drops duplicate ids", () => {
    expect(normalizePieceDownloadIds(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
});
