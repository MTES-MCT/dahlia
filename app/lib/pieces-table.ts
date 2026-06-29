// Query configuration for the pièces table, shared between the client table
// (`case-file-tabs.tsx`, which adds the display concerns: label, render, sort
// controls) and the pièce edition page (which reuses it to rebuild the exact
// same ordered/filtered list for its navigator). Prisma-free so it can run both
// in the browser bundle and in the Server Component.

import { formatDateFr } from "@/app/lib/case-file-format";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { type TableColumn, type SortOrder } from "@/app/lib/table-query";

// Minimal shape of a pièce needed to filter/sort the table. Both the full
// `attachedFiles` relation and the lighter list fetch satisfy it.
export type PieceQueryData = {
  originalFileName: string;
  dahliaName?: string | null;
  fileTypeLabel: string;
  fileFamilyType?: { label: string } | null;
  eventCreationDate: Date;
};

// Haystack for free-text and facet filters on the Nom column: Dahlia name plus
// original file name when they differ (same rule as the table cell display).
export function pieceNameSearchText(
  file: Pick<PieceQueryData, "originalFileName" | "dahliaName">,
): string {
  const dahliaName = file.dahliaName?.trim();
  return dahliaName && dahliaName !== file.originalFileName
    ? `${dahliaName} ${file.originalFileName}`
    : file.originalFileName;
}

// Haystack for free-text and facet filters on the Type column: type label plus
// family label when it differs (same rule as the table cell display).
export function pieceTypeSearchText(file: Pick<PieceQueryData, "fileTypeLabel" | "fileFamilyType">): string {
  const familyTypeLabel = file.fileFamilyType?.label;
  return familyTypeLabel && familyTypeLabel !== file.fileTypeLabel
    ? `${file.fileTypeLabel} ${familyTypeLabel}`
    : file.fileTypeLabel;
}

// Prefixed URL params isolating the pièces table state within the case-file URL,
// so it coexists with the other table (historique) and the selected tab.
export const PIECES_PARAMS: TableParamNames = {
  page: "pcPage",
  sortBy: "pcSort",
  sortOrder: "pcOrder",
  query: "pcq",
};

// Sort applied when no `pcSort` is present in the URL (date, most recent first).
export const PIECES_DEFAULT_SORT_BY = "date";
export const PIECES_DEFAULT_ORDER: SortOrder = "descending";

// Free text searches Nom + Type; Nom/Type are filterable facets; Date is only
// sortable. Mirrors the dashboard column semantics.
export const piecesQueryColumns: TableColumn<PieceQueryData>[] = [
  {
    key: "nom",
    text: pieceNameSearchText,
    sortValue: (file) => file.originalFileName,
    searchable: true,
    facet: true,
  },
  {
    key: "type",
    text: pieceTypeSearchText,
    sortValue: (file) => file.fileTypeLabel,
    searchable: true,
    facet: true,
  },
  {
    key: "date",
    text: (file) => formatDateFr(file.eventCreationDate),
    sortValue: (file) => file.eventCreationDate,
  },
];
