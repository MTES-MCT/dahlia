import { describe, expect, it } from "vitest";
import { parseClassifyArgs } from "./parse-classify-args";

const argv = (...rest: string[]) => ["node", "classify-case-files.ts", ...rest];

describe("parseClassifyArgs", () => {
  it("requires a jurisdiction (or --all-jurisdictions) and falls back to the usage", () => {
    expect(parseClassifyArgs(argv()).help).toBe(true);
    expect(parseClassifyArgs(argv("--overwrite")).help).toBe(true);
  });

  it("defaults to filling empty fields only, writing for real", () => {
    expect(parseClassifyArgs(argv("--jurisdiction", "TA069"))).toEqual({
      jurisdiction: "TA069",
      legalEntityDivisionIds: [],
      overwrite: false,
      dryRun: false,
      verbose: false,
      help: false,
    });
  });

  it("reads explicit flags", () => {
    expect(
      parseClassifyArgs(
        argv(
          "--jurisdiction",
          "TA075",
          "--legalEntityDivisionIds",
          "2488, 1234",
          "--overwrite",
          "--dry-run",
          "--verbose",
        ),
      ),
    ).toEqual({
      jurisdiction: "TA075",
      legalEntityDivisionIds: [2488, 1234],
      overwrite: true,
      dryRun: true,
      verbose: true,
      help: false,
    });
  });

  it("--all-jurisdictions drops the jurisdiction filter", () => {
    const args = parseClassifyArgs(argv("--jurisdiction", "TA069", "--all-jurisdictions"));
    expect(args).toMatchObject({ jurisdiction: undefined, help: false });
  });

  it("--help wins over a valid invocation", () => {
    expect(parseClassifyArgs(argv("--jurisdiction", "TA069", "--help")).help).toBe(true);
  });
});
