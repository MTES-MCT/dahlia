import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { normalizeForSearch, parseSearchQuery } from "@/app/lib/case-file-search";
import {
  PIECES_DEFAULT_ORDER,
  PIECES_DEFAULT_SORT_BY,
  PIECES_FACET_KEYS,
  PIECES_PARAMS,
  type PiecesFacetKey,
} from "@/app/lib/pieces-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import {
  fetchPaginatedTableData,
  resolveTablePageSize,
  type PaginatedTableData,
} from "@/app/lib/fetch-paginated-table-data";
import { type SortOrder } from "@/app/lib/table-sort";
import { parseTableQueryState } from "@/app/lib/table-query-state";

const PIECES_LIST_SELECT = {
  encodedFileId: true,
  originalFileName: true,
  dahliaName: true,
  number: true,
  comment: true,
  fileTypeLabel: true,
  fileFamilyTypeLabel: true,
  fileFamilyType: { select: { label: true } },
  eventCreationDate: true,
} satisfies Prisma.AttachedFileSelect;

type AttachedFileListRow = Prisma.AttachedFileGetPayload<{ select: typeof PIECES_LIST_SELECT }>;

function pieceNameSearchWordFilter(word: string): Prisma.AttachedFileWhereInput {
  return {
    OR: [
      { dahliaNameNormalized: { contains: word } },
      { originalFileNameNormalized: { contains: word } },
    ],
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
      return { originalFileName: direction };
    case "type":
      return { fileTypeLabel: direction };
    case "date":
    default:
      return { eventCreationDate: direction };
  }
}

function buildPiecesWhere(
  caseFileNumber: string,
  query: string | null,
): Prisma.AttachedFileWhereInput {
  const conditions: Prisma.AttachedFileWhereInput[] = [{ caseFileNumber }];

  if (query) {
    const { freeText, facets } = parseSearchQuery(query, PIECES_FACET_KEYS);

    if (freeText) {
      const normalized = normalizeForSearch(freeText);
      conditions.push({
        OR: [
          { dahliaNameNormalized: { contains: normalized } },
          { originalFileNameNormalized: { contains: normalized } },
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

export type CaseFilePiecesTableData = PaginatedTableData<CaseFilePiece>;

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

async function fetchCaseFilePiecesPage(
  caseFileNumber: string,
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<AttachedFileListRow[]> {
  const where = buildPiecesWhere(caseFileNumber, query);
  return prisma.attachedFile.findMany({
    where,
    select: PIECES_LIST_SELECT,
    orderBy: buildPiecesOrderBy(sortBy, toSortOrder(sortOrder)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function fetchCaseFilePiecesCount(
  caseFileNumber: string,
  query: string | null,
): Promise<number> {
  return prisma.attachedFile.count({ where: buildPiecesWhere(caseFileNumber, query) });
}

export async function fetchCaseFilePiecesTableData(
  caseFileNumber: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<CaseFilePiecesTableData> {
  const { page, sortBy, sortOrder, query } = parseTableQueryState(searchParams, PIECES_PARAMS, {
    defaultSortBy: PIECES_DEFAULT_SORT_BY,
    defaultOrder: PIECES_DEFAULT_ORDER,
  });
  const pageSize = await resolveTablePageSize("pieces");

  return fetchPaginatedTableData({
    page,
    pageSize,
    fetchPage: () =>
      fetchCaseFilePiecesPage(caseFileNumber, page, pageSize, sortBy, sortOrder, query),
    fetchCount: () => fetchCaseFilePiecesCount(caseFileNumber, query),
  });
}

// Full filtered/sorted list for the pièce edition navigator (no pagination).
export async function fetchCaseFilePiecesFiltered(
  caseFileNumber: string,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<CaseFilePiece[]> {
  const where = buildPiecesWhere(caseFileNumber, query);
  return prisma.attachedFile.findMany({
    where,
    select: PIECES_LIST_SELECT,
    orderBy: buildPiecesOrderBy(sortBy, toSortOrder(sortOrder)),
  });
}

// Fetch a single attached file (pièce) with its file-family label and the
// minimal case-file info needed for the breadcrumb. Returns null when unknown.
export async function fetchAttachedFile(encodedFileId: string) {
  return prisma.attachedFile.findUnique({
    where: { encodedFileId },
    include: {
      fileFamilyType: true,
      caseFile: { select: { caseFileNumber: true, title: true } },
    },
  });
}

export type AttachedFileDetail = Prisma.PromiseReturnType<typeof fetchAttachedFile>;

// Exported for unit tests asserting the generated WHERE clause.
export const piecesSearchForTests = {
  buildPiecesWhere,
  buildPiecesOrderBy,
};
