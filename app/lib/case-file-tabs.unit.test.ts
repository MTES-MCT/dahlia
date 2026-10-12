import { describe, expect, it } from "vitest";
import { isDebugTabEnabled, parseCaseFileTab } from "./case-file-tabs";

describe("isDebugTabEnabled", () => {
  it("returns true when a validated admin opts in with the debug param", () => {
    expect(isDebugTabEnabled({ debug: "1" }, true)).toBe(true);
    expect(isDebugTabEnabled({ debug: "" }, true)).toBe(true);
  });

  it("returns false when debug param is absent", () => {
    expect(isDebugTabEnabled({}, true)).toBe(false);
    expect(isDebugTabEnabled({ tab: "debug" }, true)).toBe(false);
  });

  it("returns false for a non-admin even when the debug param is present", () => {
    expect(isDebugTabEnabled({ debug: "1" }, false)).toBe(false);
  });
});

describe("parseCaseFileTab", () => {
  it("defaults to pieces", () => {
    expect(parseCaseFileTab(undefined)).toBe("pieces");
    expect(parseCaseFileTab("unknown")).toBe("pieces");
  });

  it("accepts historique without debug param", () => {
    expect(parseCaseFileTab("historique")).toBe("historique");
  });

  it("falls back to pieces for tab=debug without debug param", () => {
    expect(parseCaseFileTab("debug")).toBe("pieces");
    expect(parseCaseFileTab("debug", { tab: "debug" })).toBe("pieces");
  });

  it("accepts tab=debug when a validated admin opts in", () => {
    expect(parseCaseFileTab("debug", { debug: "1" }, true)).toBe("debug");
  });

  it("falls back to pieces for tab=debug when the caller is not an admin", () => {
    expect(parseCaseFileTab("debug", { debug: "1" }, false)).toBe("pieces");
    expect(parseCaseFileTab("debug", { debug: "1" })).toBe("pieces");
  });
});
