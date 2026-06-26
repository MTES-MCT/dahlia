import { afterEach, describe, expect, it } from "vitest";
import { parseArgs, parseDivisionIds } from "./parse-args";

const argv = (...rest: string[]) => ["node", "scrape.ts", ...rest];

describe("parseDivisionIds", () => {
  it("splits, trims and converts to numbers", () => {
    expect(parseDivisionIds("2488, 1234 ,5")).toEqual([2488, 1234, 5]);
  });
  it("ignores empty segments", () => {
    expect(parseDivisionIds(" , 7 , ")).toEqual([7]);
  });
});

describe("parseArgs", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("applies defaults when no flag is given", () => {
    const args = parseArgs(argv());
    expect(args).toMatchObject({
      jurisdiction: "TA069",
      page: 0,
      size: 30,
      all: false,
      skipEnrichment: false,
    });
  });

  it("reads explicit flags", () => {
    const args = parseArgs(
      argv("--jurisdiction", "TA075", "--page", "2", "--size", "50", "--all", "--skipEnrichment"),
    );
    expect(args).toMatchObject({
      jurisdiction: "TA075",
      page: 2,
      size: 50,
      all: true,
      skipEnrichment: true,
    });
  });

  it("an explicit --legalEntityDivisionIds wins over the env default", () => {
    process.env.TA069_TELERECOURS_DIVISIONS = "999";
    const args = parseArgs(argv("--legalEntityDivisionIds", "111,222"));
    expect(args.legalEntityDivisionIds).toEqual([111, 222]);
  });

  it("falls back to <JURISDICTION>_TELERECOURS_DIVISIONS when no CLI value", () => {
    process.env.TA075_TELERECOURS_DIVISIONS = "42,43";
    const args = parseArgs(argv("--jurisdiction", "TA075"));
    expect(args.legalEntityDivisionIds).toEqual([42, 43]);
  });

  it("anonymizes by default outside production", () => {
    delete process.env.ENVIRONMENT;
    expect(parseArgs(argv()).anonymize).toBe(true);
  });

  it("does not anonymize by default in production", () => {
    process.env.ENVIRONMENT = "production";
    expect(parseArgs(argv()).anonymize).toBe(false);
  });
});
