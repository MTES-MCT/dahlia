import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";

// Re-exported so existing imports from this data module keep working; the actual
// implementations live in a Prisma-free module shared with client components.
export { formatDateFr, getActorDisplayName };

type CaseFileWithRelations = Prisma.CaseFileGetPayload<{
  include: {
    mainClaimant: true;
    mainDefender: true;
    urgency: true;
    lastStatus: true;
    lastHearing: true;
  };
}>;

// The last element is the raw hearing convocation date (or null): the UI cell
// formats it and derives a status badge from it (see MemoryDeadlineCell).
export type CaseFileRow = [string, string, string, string, string, Date | null];

const ACTOR_SORT_KEYS = ["mainClaimant", "mainDefender"] as const;

// Sort key for the memory-production deadline column: the convocation date of
// the last hearing. It lives on the `lastHearing` relation, so it needs a
// dedicated nested orderBy (see buildOrderBy).
export const HEARING_CONVOCATION_SORT_KEY = "convocationDate";

// Pour les acteurs, on trie sur la colonne calculée `displayName` (générée en
// base, cf. migration actor_display_name) qui reproduit getActorDisplayName.
function buildOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.CaseFileOrderByWithRelationInput {
  if ((ACTOR_SORT_KEYS as readonly string[]).includes(sortBy)) {
    return { [sortBy]: { displayName: { sort: direction, nulls: "last" } } };
  }
  if (sortBy === HEARING_CONVOCATION_SORT_KEY) {
    // `convocationDate` is a required field, so the `nulls` option is not allowed
    // here. Case files without a last hearing (null relation) are sorted NULLS
    // LAST by Postgres in ascending order — which is our default — so they end up
    // last as intended.
    return { lastHearing: { convocationDate: direction } };
  }
  return { [sortBy]: direction };
}

// Normalization on the JS side to match the Postgres column `displayNameNormalized`
// (= lower(f_unaccent(displayName))). NFD + diacritics removal +
// lowercase — equivalent to unaccent for the common latin diacritics
// (é, è, ç, à, ï, ô, û, ñ, …) that cover the French-speaking need.
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Faceted-search builders: a facet `key:value` in the search box restricts the
// match to a single displayed column instead of the global OR. Keys map to the
// column names (normalized: lowercase + accents removed), so `requerant:`,
// `Requérant:` and `REQUERANT:` are all accepted. The value is matched
// case-insensitively and accent-insensitively (same rules as the free search).
// Multi-word values match when every word is found, in any order.
function facetSearchWords(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function buildWordAndFilter(
  words: string[],
  buildContains: (word: string) => Prisma.CaseFileWhereInput,
): Prisma.CaseFileWhereInput {
  if (words.length <= 1) {
    return buildContains(words[0] ?? "");
  }
  return { AND: words.map(buildContains) };
}

const FACET_BUILDERS: Record<
  string,
  (normalizedValue: string, rawValue: string) => Prisma.CaseFileWhereInput
> = {
  dossier: (_normalized, raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => ({
      caseFileNumber: { contains: word, mode: "insensitive" },
    })),
  requerant: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      mainClaimant: { displayNameNormalized: { contains: word } },
    })),
  defendeur: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      mainDefender: { displayNameNormalized: { contains: word } },
    })),
  statut: (normalized) =>
    buildWordAndFilter(facetSearchWords(normalized), (word) => ({
      lastStatus: ({ labelNormalized: { contains: word } } as unknown as Prisma.StatusWhereInput),
    })),
};

// Facet keys recognized in the search box (column names of the table).
export const FACET_KEYS = Object.keys(FACET_BUILDERS);

const FACET_KEY_SET = new Set<string>(FACET_KEYS);

export type ParsedSearch = {
  // Free text searched globally (OR across caseFileNumber + actors), or null.
  freeText: string | null;
  // Column-scoped filters extracted from `key:value` tokens.
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
export function parseSearchQuery(query: string): ParsedSearch {
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
      if (value && FACET_KEY_SET.has(normalizedKey)) {
        facets.push({ key: normalizedKey, value });
        continue;
      }
    }
    freeTokens.push(token);
  }

  return { freeText: freeTokens.join(" ") || null, facets };
}

// Build the Prisma filter combining the search box (free text + facets) and the
// status label filter. All criteria are combined with AND; each criterion
// absent (null) is ignored.
function buildWhere(query: string | null, statusLabel: string | null): Prisma.CaseFileWhereInput {
  // Soft-deleted case files (absent from the latest Telerecours scrape within
  // their perimeter) are always hidden from the UI.
  const conditions: Prisma.CaseFileWhereInput[] = [{ isDeleted: false } as Prisma.CaseFileWhereInput];

  if (query) {
    const { freeText, facets } = parseSearchQuery(query);

    // Free text: global OR across the case-file number and both actors.
    if (freeText) {
      const normalized = normalizeForSearch(freeText);
      conditions.push({
        OR: [
          { caseFileNumber: { contains: freeText, mode: "insensitive" } },
          { mainClaimant: { displayNameNormalized: { contains: normalized } } },
          { mainDefender: { displayNameNormalized: { contains: normalized } } },
        ],
      });
    }

    // Facets: each one restricts a single column; combined with AND.
    for (const facet of facets) {
      conditions.push(FACET_BUILDERS[facet.key](normalizeForSearch(facet.value), facet.value));
    }
  }

  if (statusLabel) {
    conditions.push({ lastStatus: { label: statusLabel } });
  }

  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

async function fetchCaseFiles(
  page: number,
  numberOfCaseFiles: number,
  sortBy: string | null,
  sortOrder: string | null = null,
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<CaseFileWithRelations[]> {
  const direction: Prisma.SortOrder = sortOrder === "ascending" ? "asc" : "desc";
  const where = buildWhere(query, statusLabel);
  return prisma.caseFile.findMany({
    include: {
      mainClaimant: true,
      mainDefender: true,
      urgency: true,
      lastStatus: true,
      lastHearing: true,
    },
    where,
    ...(sortBy ? { orderBy: buildOrderBy(sortBy, direction) } : {}),
    skip: (page - 1) * numberOfCaseFiles,
    take: numberOfCaseFiles,
  });
}

async function fetchCaseFilesCount(
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<number> {
  const where = buildWhere(query, statusLabel);
  return prisma.caseFile.count({ where });
}

// Status labels actually used by at least one case file — source of truth for the filter dropdown and server-side validation.
// Sometimes several `Status` lines share the same `label` (cf. Telerecours catalogue): we deduplicate on the label.
export async function fetchUsedStatusLabels(): Promise<string[]> {
  const statuses = await prisma.status.findMany({
    where: { caseFiles: { some: { isDeleted: false } as Prisma.CaseFileWhereInput } },
    select: { label: true },
    distinct: ["label"],
    orderBy: { label: "asc" },
  });
  return statuses.map((s) => s.label);
}

export function formatForTable(caseFiles: CaseFileWithRelations[]): CaseFileRow[] {
  return caseFiles.map((caseFile) => [
    caseFile.caseFileNumber,
    formatDateFr(caseFile.depositDate),
    getActorDisplayName(caseFile.mainClaimant),
    getActorDisplayName(caseFile.mainDefender),
    caseFile.lastStatus.label,
    caseFile.lastHearing?.convocationDate ?? null,
  ]);
}

export type CaseFilesTableData = {
  rows: CaseFileRow[];
  totalPages: number;
  totalCount: number;
};

// case-file detail with all its relations, for the detail page.
// Load the complete tree (actors, status, hearings → conclusions,
// events → measures/files, related case files) to display it in JSON.
export async function fetchCaseFileDetail(caseFileNumber: string) {
  return prisma.caseFile.findUnique({
    where: { caseFileNumber },
    include: {
      mainClaimant: true,
      mainDefender: true,
      urgency: true,
      lastStatus: true,
      chamber: true,
      assignedToLegalEntityDivision: true,
      lastHearing: { include: { lastConclusion: { include: { conclusionOperativePart: true } } } },
      hearings: { include: { lastConclusion: { include: { conclusionOperativePart: true } } } },
      events: {
        include: { measure: true, actor: true, attachedFiles: true },
        orderBy: { eventDate: "desc" },
      },
      attachedFiles: true,
      relatedSources: { include: { relatedCaseFile: true } },
      relatedTargets: { include: { caseFile: true } },
    },
  });
}

export type CaseFileDetail = Prisma.PromiseReturnType<typeof fetchCaseFileDetail>;

export async function fetchCaseFilesTableData(
  page: number,
  numberOfCaseFiles: number,
  sortBy: string | null,
  sortOrder: string,
  query: string | null = null,
  statusLabel: string | null = null,
): Promise<CaseFilesTableData> {
  const [caseFiles, totalCount] = await Promise.all([
    fetchCaseFiles(page, numberOfCaseFiles, sortBy, sortOrder, query, statusLabel),
    fetchCaseFilesCount(query, statusLabel),
  ]);
  return {
    rows: formatForTable(caseFiles),
    totalPages: Math.ceil(totalCount / numberOfCaseFiles),
    totalCount: totalCount,
  };
}
