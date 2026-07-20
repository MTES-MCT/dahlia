// Pure search-grammar helpers shared between Server Components (the Prisma
// `buildWhere` in `case-files.ts`) and Client Components (the column filter
// buttons). They must NOT import the Prisma client, so the search box grammar
// can be reused in the browser bundle without dragging server-only code in.

// Normalization on the JS side to match the Postgres columns `displayNameNormalized`
// / `labelNormalized` (= lower(f_unaccent(...))). NFD + diacritics removal +
// lowercase — equivalent to unaccent for the common latin diacritics
// (é, è, ç, à, ï, ô, û, ñ, …) that cover the French-speaking need.
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Facet keys recognized in the search box. They map to the displayed table
// columns; a `key:value` token restricts the match to that single column
// instead of the global free-text OR.
export const DOSSIER_FACET_FIELDS = [
  { key: "dossier", label: "Numéro" },
  { key: "titre", label: "Titre" },
  { key: "requerant", label: "Requérant" },
  { key: "defendeur", label: "Défendeur" },
] as const;

export type DossierFacetKey = (typeof DOSSIER_FACET_FIELDS)[number]["key"];

export const FACET_KEYS = [
  ...DOSSIER_FACET_FIELDS.map((field) => field.key),
  "producteur",
] as const;

export type FacetKey = (typeof FACET_KEYS)[number];

export function isFacetKey(
  key: string,
  validKeys: readonly string[] = FACET_KEYS,
): key is FacetKey {
  return validKeys.includes(key);
}

export type ParsedSearch = {
  // Free text searched globally (OR across the searchable columns), or null.
  freeText: string | null;
  // Column-scoped filters extracted from `key:value` tokens. The key is a string
  // (not the dashboard's FacetKey) so the grammar is reusable by any table that
  // declares its own facet keys.
  facets: { key: string; value: string }[];
};

type SearchToken = { value: string; quoted: boolean };

// Split on whitespace while keeping double-quoted segments as a single token
// (quotes are stripped when the whole token is quoted). Quoted spans embedded
// in an unquoted token (e.g. facet values) are kept as part of that token.
function tokenizeSearchQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const trimmed = query.trim();
  let i = 0;

  while (i < trimmed.length) {
    while (i < trimmed.length && /\s/.test(trimmed[i])) {
      i++;
    }
    if (i >= trimmed.length) break;

    if (trimmed[i] === '"') {
      i++;
      const start = i;
      while (i < trimmed.length && trimmed[i] !== '"') {
        i++;
      }
      tokens.push({ value: trimmed.slice(start, i), quoted: true });
      if (i < trimmed.length) i++;
      continue;
    }

    const start = i;
    while (i < trimmed.length) {
      if (/\s/.test(trimmed[i])) break;
      if (trimmed[i] === '"') {
        i++;
        while (i < trimmed.length && trimmed[i] !== '"') {
          i++;
        }
        if (i < trimmed.length) i++;
        continue;
      }
      i++;
    }
    tokens.push({ value: trimmed.slice(start, i), quoted: false });
  }

  return tokens.filter((token) => token.value.length > 0);
}

function unwrapQuotedValue(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

// Split the raw search string into facets (`key:value` whose key is a known
// column) and the remaining free text. A token is a facet only when its key is
// recognized and its value is non-empty; otherwise it stays free text — so a
// stray colon never silently drops a search term. Double-quoted segments are
// kept as one token even when they contain spaces.
export function parseSearchQuery(
  query: string,
  validKeys: readonly string[] = FACET_KEYS,
): ParsedSearch {
  const tokens = tokenizeSearchQuery(query);
  const facets: { key: string; value: string }[] = [];
  const freeTokens: string[] = [];

  for (const { value: token, quoted } of tokens) {
    if (quoted) {
      freeTokens.push(token);
      continue;
    }

    const separatorIndex = token.indexOf(":");
    if (separatorIndex > 0) {
      const normalizedKey = normalizeForSearch(token.slice(0, separatorIndex));
      const value = unwrapQuotedValue(token.slice(separatorIndex + 1));
      if (value && isFacetKey(normalizedKey, validKeys)) {
        facets.push({ key: normalizedKey, value });
        continue;
      }
    }
    freeTokens.push(token);
  }

  return { freeText: freeTokens.join(" ") || null, facets };
}

// A facet value is wrapped in double quotes when it contains whitespace, so the
// tokenizer keeps it as a single token on the next parse (round-trip safe).
function formatFacetValue(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

// Serialize a parsed search back into the raw `dahliaq` string: free text first,
// then each facet as `key:value` (quoting multi-word values).
export function serializeSearch({ freeText, facets }: ParsedSearch): string {
  const parts: string[] = [];
  if (freeText) parts.push(freeText);
  for (const { key, value } of facets) {
    parts.push(`${key}:${formatFacetValue(value)}`);
  }
  return parts.join(" ");
}

// Return a new search string where the facet for `key` is set to `value`
// (replacing any existing one), or removed when `value` is empty. Used by the
// per-column filter buttons to inject a facet into the current search box.
export function setFacet(
  query: string,
  key: string,
  value: string,
  validKeys: readonly string[] = FACET_KEYS,
): string {
  const parsed = parseSearchQuery(query, validKeys);
  const trimmed = value.trim();
  const others = parsed.facets.filter((facet) => facet.key !== key);
  const facets = trimmed ? [...others, { key, value: trimmed }] : others;
  return serializeSearch({ freeText: parsed.freeText, facets });
}

// Apply several facet updates in one pass (empty values remove the facet).
export function setFacetValues(
  query: string,
  values: Record<string, string>,
  validKeys: readonly string[] = FACET_KEYS,
): string {
  const parsed = parseSearchQuery(query, validKeys);
  const keysToUpdate = new Set(Object.keys(values));
  const others = parsed.facets.filter((facet) => !keysToUpdate.has(facet.key));
  const facets = [...others];

  for (const [key, rawValue] of Object.entries(values)) {
    const trimmed = rawValue.trim();
    if (trimmed && isFacetKey(key, validKeys)) {
      facets.push({ key, value: trimmed });
    }
  }

  return serializeSearch({ freeText: parsed.freeText, facets });
}

// Current value of a given facet in the search string, or "" when absent.
export function getFacetValue(
  query: string,
  key: string,
  validKeys: readonly string[] = FACET_KEYS,
): string {
  return parseSearchQuery(query, validKeys).facets.find((facet) => facet.key === key)?.value ?? "";
}

// URL query-param names backing a table's sort/filter/pagination state. The
// dashboard owns the page-level params; tables sharing a single URL (the case
// file detail tabs) pass a prefixed set so they don't collide with each other.
export type TableParamNames = {
  page: string;
  sortBy: string;
  sortOrder: string;
  query: string;
};

export const DASHBOARD_TABLE_PARAMS: TableParamNames = {
  page: "page",
  sortBy: "sortBy",
  sortOrder: "sortOrder",
  query: "dahliaq",
};
