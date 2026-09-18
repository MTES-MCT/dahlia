import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAG_COLOR,
  TAG_COLORS,
  TAG_COLOR_LABELS,
  TAG_COLOR_OPTIONS,
  isTagColor,
  tagBadgeClassName,
} from "@/app/lib/tag-colors";

describe("tag-colors", () => {
  it("expose un libellé français pour chaque couleur", () => {
    for (const color of TAG_COLORS) {
      expect(TAG_COLOR_LABELS[color]).toBeTruthy();
    }
    expect(TAG_COLOR_OPTIONS).toHaveLength(TAG_COLORS.length);
  });

  it("reconnaît les couleurs de la palette et rejette les autres", () => {
    expect(isTagColor("green-menthe")).toBe(true);
    expect(isTagColor("fr-tag--green-menthe")).toBe(false);
    expect(isTagColor("chartreuse")).toBe(false);
  });

  // Tags are badges: DSFR styles badge accents on any element.
  it("construit la classe de badge DSFR", () => {
    expect(tagBadgeClassName("green-menthe")).toBe("fr-badge--green-menthe");
  });

  // A colour dropped from the palette (or an unexpected database value) must
  // still render with a valid DSFR accent rather than an unknown class.
  it("retombe sur la couleur par défaut pour une valeur inconnue", () => {
    expect(tagBadgeClassName("chartreuse")).toBe(`fr-badge--${DEFAULT_TAG_COLOR}`);
    expect(tagBadgeClassName("")).toBe(`fr-badge--${DEFAULT_TAG_COLOR}`);
  });

  it("utilise une couleur de la palette comme valeur par défaut", () => {
    expect(isTagColor(DEFAULT_TAG_COLOR)).toBe(true);
  });
});
