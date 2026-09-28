import { describe, expect, it } from "vitest";
import { parseComedArgs } from "./parse-comed-args";

const argv = (...rest: string[]) => ["node", "find-comed-decisions.ts", ...rest];

describe("parseComedArgs", () => {
  it("defaults to a summary without export", () => {
    expect(parseComedArgs(argv())).toEqual({ exportCsv: undefined, help: false });
  });

  it("reads the CSV export path, including the pnpm option separator", () => {
    expect(parseComedArgs(argv("--export-csv", "audits/comed.csv"))).toEqual({
      exportCsv: "audits/comed.csv",
      help: false,
    });
    expect(parseComedArgs(argv("--", "--export-csv", "audits/comed.csv")).exportCsv).toBe(
      "audits/comed.csv",
    );
  });

  it("recognizes --help", () => {
    expect(parseComedArgs(argv("--help")).help).toBe(true);
    expect(parseComedArgs(argv("-h")).help).toBe(true);
  });

  it("rejects --export-csv without a path", () => {
    expect(() => parseComedArgs(argv("--export-csv"))).toThrow(/Missing value for --export-csv/);
  });

  it("rejects an unknown argument", () => {
    expect(() => parseComedArgs(argv("--jurisdiction", "TA069"))).toThrow(/Unknown argument/);
  });
});
