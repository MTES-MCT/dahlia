// Normalize a free-text field before matching it against the rules:
// accents removed, lower case, and every non-alphanumeric character (typography
// apostrophes, underscores, slashes, CR/LF …) collapsed into a single space.
// Telerecours titles are hand-typed and mix "DALO_Liquidation d'astreinte",
// "DALO - Liquidation d'astreintes" and multi-line values, so rule patterns are
// written once against this canonical form.
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
