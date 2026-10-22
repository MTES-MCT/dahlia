import { describe, expect, it } from "vitest";
import { isDebugTabEnabled, parseCaseFileTab, pieceTabSuffix } from "./case-file-tabs";

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
  it("defaults to synthese", () => {
    expect(parseCaseFileTab(undefined)).toBe("synthese");
    expect(parseCaseFileTab("unknown")).toBe("synthese");
  });

  it("accepts pieces", () => {
    expect(parseCaseFileTab("pieces")).toBe("pieces");
  });

  it("accepts historique without debug param", () => {
    expect(parseCaseFileTab("historique")).toBe("historique");
  });

  it("falls back to synthese for tab=debug without debug param", () => {
    expect(parseCaseFileTab("debug")).toBe("synthese");
    expect(parseCaseFileTab("debug", { tab: "debug" })).toBe("synthese");
  });

  it("accepts tab=debug when a validated admin opts in", () => {
    expect(parseCaseFileTab("debug", { debug: "1" }, true)).toBe("debug");
  });

  it("falls back to synthese for tab=debug when the caller is not an admin", () => {
    expect(parseCaseFileTab("debug", { debug: "1" }, false)).toBe("synthese");
    expect(parseCaseFileTab("debug", { debug: "1" })).toBe("synthese");
  });
});

describe("pieceTabSuffix", () => {
  it("conserve les paramètres de recherche du tableau de bord", () => {
    expect(
      pieceTabSuffix("f1", { q: "dupont", page: "2", tab: "synthese", piece: "ancienne" }),
    ).toBe("?q=dupont&page=2&tab=pieces&piece=f1");
  });

  it("opens the pièces tab on the given pièce, URL-encoded", () => {
    expect(pieceTabSuffix("L0FU/VE+FDS==")).toBe("?tab=pieces&piece=L0FU%2FVE%2BFDS%3D%3D");
  });
});
