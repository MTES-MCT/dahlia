import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

type CaseFileWithRelations = Prisma.CaseFileGetPayload<{
  include: {
    mainClaimant: true;
    mainDefender: true;
    urgency: true;
    lastStatus: true;
  };
}>;

export type CaseFileRow = [string, string, string, string, string];

export function getActorDisplayName(actor: CaseFileWithRelations["mainDefender"]): string {
  if (!actor) return "N/A";
  if (actor.legalPersonName) return actor.legalPersonName;
  if (actor.legalEntityName) return actor.legalEntityName;
  if (actor.firstName && actor.lastName) return `${actor.lastName} ${actor.firstName}`;
  if (actor.lastName) return actor.lastName;
  if (actor.firstName) return actor.firstName;
  return "N/A";
}

const ACTOR_SORT_KEYS = ["mainClaimant", "mainDefender"] as const;

// Pour les acteurs, on trie sur la colonne calculée `displayName` (générée en
// base, cf. migration actor_display_name) qui reproduit getActorDisplayName.
function buildOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.CaseFileOrderByWithRelationInput {
  if ((ACTOR_SORT_KEYS as readonly string[]).includes(sortBy)) {
    return { [sortBy]: { displayName: { sort: direction, nulls: "last" } } };
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

// Build the Prisma filter combining the text search (case-insensitive and accent-insensitive) and the status label filter.
// All criteria are combined with AND; each criterion absent (null) is ignored.
function buildWhere(
  query: string | null,
  statusLabel: string | null,
): Prisma.CaseFileWhereInput | undefined {
  const conditions: Prisma.CaseFileWhereInput[] = [];

  if (query) {
    const normalized = normalizeForSearch(query);
    conditions.push({
      OR: [
        { caseFileNumber: { contains: query, mode: "insensitive" } },
        { mainClaimant: { displayNameNormalized: { contains: normalized } } },
        { mainDefender: { displayNameNormalized: { contains: normalized } } },
      ],
    });
  }

  if (statusLabel) {
    conditions.push({ lastStatus: { label: statusLabel } });
  }

  if (conditions.length === 0) return undefined;
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
    },
    ...(where ? { where } : {}),
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
  return prisma.caseFile.count(where ? { where } : undefined);
}

// Status labels actually used by at least one case file — source of truth for the filter dropdown and server-side validation.
// Sometimes several `Status` lines share the same `label` (cf. Telerecours catalogue): we deduplicate on the label.
export async function fetchUsedStatusLabels(): Promise<string[]> {
  const statuses = await prisma.status.findMany({
    where: { caseFiles: { some: {} } },
    select: { label: true },
    distinct: ["label"],
    orderBy: { label: "asc" },
  });
  return statuses.map((s) => s.label);
}

export function formatForTable(caseFiles: CaseFileWithRelations[]): CaseFileRow[] {
  return caseFiles.map((caseFile) => [
    caseFile.caseFileNumber,
    getActorDisplayName(caseFile.mainClaimant),
    getActorDisplayName(caseFile.mainDefender),
    caseFile.urgency?.description || "N/A",
    caseFile.lastStatus.label,
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
