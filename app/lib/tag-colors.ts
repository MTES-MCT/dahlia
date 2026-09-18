// Tag colour palette. Client-safe on purpose (no Prisma import), so the picker
// and the admin forms can use it in the browser bundle, like `case-file-enums.ts`.
//
// The values are the DSFR accentuation names, shared by `fr-badge--<accent>` and
// `fr-tag--<accent>`. Beware that DSFR only styles the *tag* accents on
// interactive elements (`a`, `button`, `input`): a `<span>`/`<p>` tag stays grey.
// Tags are therefore always rendered as small badges, whose accent classes apply
// to any element.

export const TAG_COLOR_LABELS = {
  "blue-ecume": "Bleu écume",
  "blue-cumulus": "Bleu cumulus",
  "green-tilleul-verveine": "Vert tilleul verveine",
  "green-bourgeon": "Vert bourgeon",
  "green-emeraude": "Vert émeraude",
  "green-menthe": "Vert menthe",
  "green-archipel": "Vert archipel",
  "purple-glycine": "Violet glycine",
  "pink-macaron": "Rose macaron",
  "pink-tuile": "Rose tuile",
  "yellow-tournesol": "Jaune tournesol",
  "yellow-moutarde": "Jaune moutarde",
  "orange-terre-battue": "Orange terre battue",
  "brown-cafe-creme": "Brun café crème",
  "brown-caramel": "Brun caramel",
  "brown-opera": "Brun opéra",
  "beige-gris-galet": "Beige gris galet",
} as const;

export type TagColor = keyof typeof TAG_COLOR_LABELS;

export const TAG_COLORS = Object.keys(TAG_COLOR_LABELS) as readonly TagColor[];

export type TagBadgeClassName = `fr-badge--${TagColor}`;

export const DEFAULT_TAG_COLOR: TagColor = "blue-ecume";

export const TAG_COLOR_OPTIONS: { value: TagColor; label: string }[] = TAG_COLORS.map((color) => ({
  value: color,
  label: TAG_COLOR_LABELS[color],
}));

export function isTagColor(value: string): value is TagColor {
  return (TAG_COLORS as readonly string[]).includes(value);
}

// Falls back to the default accent so a colour removed from the palette (or an
// unexpected database value) still renders with a valid DSFR accent.
function resolveTagColor(color: string): TagColor {
  return isTagColor(color) ? color : DEFAULT_TAG_COLOR;
}

// Accent class for a tag, rendered as a small DSFR badge.
export function tagBadgeClassName(color: string): TagBadgeClassName {
  return `fr-badge--${resolveTagColor(color)}`;
}
