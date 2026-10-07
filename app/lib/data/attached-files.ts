import { Prisma } from "@prisma/client";
import type { CaseFileKey } from "@/app/lib/case-file-key";
import { prisma } from "@/app/lib/prisma";
import { caseFileRelationScopeWhere, logCaseFileScopeMiss } from "@/app/lib/case-file-scope";
import { normalizeForSearch, parseSearchQuery } from "@/app/lib/case-file-search";
import { PIECES_FACET_KEYS, type PiecesFacetKey } from "@/app/lib/pieces-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import { type SortOrder } from "@/app/lib/table-sort";

const PIECES_LIST_SELECT = {
  encodedFileId: true,
  fileName: true,
  dahliaName: true,
  number: true,
  comment: true,
  mimeType: true,
  fileTypeLabel: true,
  fileFamilyTypeLabel: true,
  fileFamilyType: { select: { label: true } },
  eventCreationDate: true,
} satisfies Prisma.AttachedFileSelect;

type AttachedFileListRow = Prisma.AttachedFileGetPayload<{ select: typeof PIECES_LIST_SELECT }>;

function pieceNameSearchWordFilter(word: string): Prisma.AttachedFileWhereInput {
  return {
    OR: [{ dahliaNameNormalized: { contains: word } }, { fileNameNormalized: { contains: word } }],
  };
}

function pieceTypeSearchWordFilter(word: string): Prisma.AttachedFileWhereInput {
  return {
    OR: [
      { fileTypeLabelNormalized: { contains: word } },
      { fileFamilyTypeLabelNormalized: { contains: word } },
    ],
  };
}

function buildPiecesOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.AttachedFileOrderByWithRelationInput {
  switch (sortBy) {
    case "nom":
      return { fileName: direction };
    case "type":
      return { fileTypeLabel: direction };
    case "date":
    default:
      return { eventCreationDate: direction };
  }
}

function buildPiecesWhere(key: CaseFileKey, query: string | null): Prisma.AttachedFileWhereInput {
  const conditions: Prisma.AttachedFileWhereInput[] = [
    { jurisdictionCode: key.jurisdictionCode, caseFileNumber: key.caseFileNumber },
  ];

  if (query) {
    const { freeText, facets } = parseSearchQuery(query, PIECES_FACET_KEYS);

    if (freeText) {
      const normalized = normalizeForSearch(freeText);
      conditions.push({
        OR: [
          { dahliaNameNormalized: { contains: normalized } },
          { fileNameNormalized: { contains: normalized } },
          { fileTypeLabelNormalized: { contains: normalized } },
          { fileFamilyTypeLabelNormalized: { contains: normalized } },
        ],
      });
    }

    for (const facet of facets) {
      switch (facet.key as PiecesFacetKey) {
        case "nom":
          conditions.push(
            buildWordAndFilter(
              facetSearchWords(normalizeForSearch(facet.value)),
              pieceNameSearchWordFilter,
            ),
          );
          break;
        case "type":
          conditions.push(
            buildWordAndFilter(
              facetSearchWords(normalizeForSearch(facet.value)),
              pieceTypeSearchWordFilter,
            ),
          );
          break;
      }
    }
  }

  return combineAnd(conditions);
}

export type CaseFilePiece = AttachedFileListRow;

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

// Full filtered/sorted list for the pièces workspace sidebar.
export async function fetchCaseFilePiecesFiltered(
  key: CaseFileKey,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<CaseFilePiece[]> {
  const where = {
    ...buildPiecesWhere(key, query),
    ...(await caseFileRelationScopeWhere()),
  };
  return prisma.attachedFile.findMany({
    where,
    select: PIECES_LIST_SELECT,
    orderBy: buildPiecesOrderBy(sortBy, toSortOrder(sortOrder)),
  });
}

// Fetch a single attached file (pièce) of a case file. `encodedFileId` is only
// unique within a court, hence the case-file key. Returns null when unknown,
// attached to another case file, *or* when its case file lies outside the
// current user's permission scope — which is what makes the pièce routes
// (viewer and zip download) answer 404 in that case.
export async function fetchAttachedFile(key: CaseFileKey, encodedFileId: string) {
  const file = await prisma.attachedFile.findFirst({
    where: {
      jurisdictionCode: key.jurisdictionCode,
      caseFileNumber: key.caseFileNumber,
      encodedFileId,
      ...(await caseFileRelationScopeWhere()),
    },
  });
  if (!file) {
    await logCaseFileScopeMiss({ resource: "attached_file", ...key, encodedFileId });
  }
  return file;
}

export type AttachedFileDetail = Prisma.PromiseReturnType<typeof fetchAttachedFile>;

// Exported for unit tests asserting the generated WHERE clause.
export const piecesSearchForTests = {
  buildPiecesWhere,
  buildPiecesOrderBy,
};
