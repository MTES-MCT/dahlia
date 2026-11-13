import { describe, expect, it } from "vitest";
import { comedFilesExportDirName } from "./export-comed-files";

describe("comedFilesExportDirName", () => {
  it("formats the export folder with the local calendar date", () => {
    expect(comedFilesExportDirName(new Date(2026, 2, 5, 23, 59, 0))).toBe("comed-files-2026-03-05");
  });
});
