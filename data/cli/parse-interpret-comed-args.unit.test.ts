import { describe, expect, it } from "vitest";
import { parseInterpretComedArgs } from "./parse-interpret-comed-args";

const argv = (...args: string[]) => ["node", "script", ...args];

describe("parseInterpretComedArgs", () => {
  it("applies defaults", () => {
    expect(parseInterpretComedArgs(argv())).toEqual({
      jurisdiction: null,
      enrich: "ongoing",
      forceDocumentIa: false,
      help: false,
    });
  });

  it("reads every option", () => {
    expect(
      parseInterpretComedArgs(
        argv("--", "--jurisdiction", "TA034", "--enrich", "all", "--force-document-ia"),
      ),
    ).toEqual({ jurisdiction: "TA034", enrich: "all", forceDocumentIa: true, help: false });
  });

  it("rejects an invalid --enrich value", () => {
    expect(() => parseInterpretComedArgs(argv("--enrich", "none"))).toThrow(/all \| ongoing/);
    expect(() => parseInterpretComedArgs(argv("--enrich"))).toThrow(/all \| ongoing/);
  });

  it("rejects a missing jurisdiction and unknown options", () => {
    expect(() => parseInterpretComedArgs(argv("--jurisdiction", "--enrich"))).toThrow(
      /--jurisdiction/,
    );
    expect(() => parseInterpretComedArgs(argv("--nope"))).toThrow(/Unknown argument/);
  });
});
