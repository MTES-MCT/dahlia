import { describe, expect, it } from "vitest";
import { parseExportComedArgs } from "./export-comed-interpretations";

const argv = (...args: string[]) => ["node", "script", ...args];

describe("parseExportComedArgs", () => {
  it("applies defaults", () => {
    expect(parseExportComedArgs(argv())).toEqual({
      jurisdiction: null,
      output: null,
      exportAll: false,
      help: false,
    });
  });

  it("reads --export-all", () => {
    expect(parseExportComedArgs(argv("--jurisdiction", "TA069", "--export-all"))).toEqual({
      jurisdiction: "TA069",
      output: null,
      exportAll: true,
      help: false,
    });
  });
});
