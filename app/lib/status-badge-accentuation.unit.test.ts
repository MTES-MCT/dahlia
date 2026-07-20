import { describe, expect, it } from "vitest";
import {
  STATUS_BADGE_ACCENTUATION,
  statusBadgeAccentuation,
  statusBadgeAccentuationClassName,
} from "@/app/lib/status-badge-accentuation";

describe("statusBadgeAccentuation", () => {
  it("returns the configured accentuation for known status labels", () => {
    expect(statusBadgeAccentuation("Terminé")).toBe("green-menthe");
    expect(statusBadgeAccentuation("Dossier rayé")).toBe("pink-tuile");
    expect(statusBadgeAccentuation("Inscrit au rôle d'une audience")).toBe("yellow-moutarde");
  });

  it("falls back to blue-cumulus for unknown status labels", () => {
    expect(statusBadgeAccentuation("Statut inconnu")).toBe("blue-cumulus");
  });

  it("covers every dashboard filter status", () => {
    for (const label of Object.keys(STATUS_BADGE_ACCENTUATION)) {
      expect(statusBadgeAccentuation(label)).toBe(STATUS_BADGE_ACCENTUATION[label]);
    }
  });

  it("builds the DSFR badge accentuation class name", () => {
    expect(statusBadgeAccentuationClassName("Terminé")).toBe("fr-badge--green-menthe");
  });
});
