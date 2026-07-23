import { describe, expect, it } from "vitest";
import {
  PREFERRED_DEFAULT_STATUT,
  resolveCurrentStatut,
  resolveDefaultStatut,
} from "@/app/lib/dashboard-filter";

describe("resolveDefaultStatut", () => {
  it("prefers the configured default when present in the catalogue", () => {
    expect(
      resolveDefaultStatut(["Terminé", PREFERRED_DEFAULT_STATUT, "En cours d'instruction"]),
    ).toBe(PREFERRED_DEFAULT_STATUT);
  });

  it("falls back to the first non-terminated label", () => {
    expect(resolveDefaultStatut(["Terminé", "En cours d'instruction"])).toBe(
      "En cours d'instruction",
    );
  });

  it("returns null when the catalogue is empty", () => {
    expect(resolveDefaultStatut([])).toBeNull();
  });
});

describe("resolveCurrentStatut", () => {
  it("uses the resolved default when the param is absent", () => {
    expect(resolveCurrentStatut(undefined, "En cours d'instruction")).toBe(
      "En cours d'instruction",
    );
  });

  it("returns null when the param is absent and there is no default", () => {
    expect(resolveCurrentStatut(undefined, null)).toBeNull();
  });

  it("returns null for an explicit empty param", () => {
    expect(resolveCurrentStatut("", "En cours d'instruction")).toBeNull();
  });

  it("trims a non-empty param", () => {
    expect(resolveCurrentStatut("  Terminé  ", "En cours d'instruction")).toBe("Terminé");
  });
});
