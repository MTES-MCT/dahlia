import { describe, expect, it } from "vitest";
import { isDebugTabEnabled, parseCaseFileTab } from "./case-file-tabs";

describe("isDebugTabEnabled", () => {
  it("returns true when debug param is present", () => {
    expect(isDebugTabEnabled({ debug: "1" })).toBe(true);
    expect(isDebugTabEnabled({ debug: "" })).toBe(true);
  });

  it("returns false when debug param is absent", () => {
    expect(isDebugTabEnabled({})).toBe(false);
    expect(isDebugTabEnabled({ tab: "debug" })).toBe(false);
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

  it("accepts tab=debug when debug param is present", () => {
    expect(parseCaseFileTab("debug", { debug: "1" })).toBe("debug");
  });
});
