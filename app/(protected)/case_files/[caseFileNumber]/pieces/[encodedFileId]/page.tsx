import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { fetchAttachedFile, fetchCaseFilePieces } from "@/app/lib/data/attached-files";
import { queryTableRows, type SortOrder } from "@/app/lib/table-query";
import {
  PIECES_PARAMS,
  PIECES_DEFAULT_SORT_BY,
  PIECES_DEFAULT_ORDER,
  piecesQueryColumns,
} from "@/app/lib/pieces-table";
import { PieceViewer } from "@/app/ui/piece-viewer";
import { PieceNavigator } from "@/app/ui/piece-navigator";
import { PieceMetadata } from "@/app/ui/piece-metadata";
import { PieceMetadataForm } from "@/app/ui/piece-metadata-form";

type Props = {
  params: Promise<{ caseFileNumber: string; encodedFileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Label for the case file in the breadcrumb: number + optional title.
function caseFileLabel(caseFileNumber: string, title: string | null): string {
  return caseFileNumber + (title ? ` - ${title}` : "");
}

export default async function Page({ params, searchParams }: Props) {
  const { caseFileNumber, encodedFileId } = await params;
  const decodedCaseFileNumber = decodeURIComponent(caseFileNumber);
  const decodedFileId = decodeURIComponent(encodedFileId);

  const file = await fetchAttachedFile(decodedFileId);
  if (!file || file.caseFileNumber !== decodedCaseFileNumber) {
    notFound();
  }

  // Preserve the user's current search/sort/pagination/tab state so the
  // breadcrumb links rebuild the dashboard and the case file exactly as they
  // were. We forward every string param: the dashboard ignores the case-file
  // table params it doesn't know, and vice versa.
  const resolvedSearchParams = await searchParams;
  const carriedParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") carriedParams.set(key, value);
  }
  const queryString = carriedParams.toString();
  const suffix = queryString ? `?${queryString}` : "";

  const dashboardHref = `/case_files${suffix}`;
  const encodedCaseFileNumber = encodeURIComponent(decodedCaseFileNumber);
  const caseFileHref = `/case_files/${encodedCaseFileNumber}${suffix}`;
  const dataUrl = `/case_files/${encodedCaseFileNumber}/pieces/${encodeURIComponent(decodedFileId)}/data`;

  // Rebuild the pièces list in the exact order/filter the table had when the
  // user clicked: the carried query string holds the table's sort/search params.
  // Pagination is ignored on purpose so every matching pièce is reachable from
  // the navigator, not only the table page that was visible.
  const allPieces = await fetchCaseFilePieces(decodedCaseFileNumber);
  const rawSortBy = carriedParams.get(PIECES_PARAMS.sortBy);
  const sortBy = rawSortBy ?? PIECES_DEFAULT_SORT_BY;
  const sortOrder: SortOrder = rawSortBy
    ? ((carriedParams.get(PIECES_PARAMS.sortOrder) ?? "descending") as SortOrder)
    : PIECES_DEFAULT_ORDER;
  const { pageRows: orderedPieces } = queryTableRows(allPieces, piecesQueryColumns, {
    query: carriedParams.get(PIECES_PARAMS.query),
    sortBy,
    sortOrder,
    page: 1,
    pageSize: Math.max(allPieces.length, 1),
  });
  const pieceOptions = orderedPieces.map((piece) => ({
    encodedFileId: piece.encodedFileId,
    label: piece.dahliaName ?? piece.originalFileName,
    href: `/case_files/${encodedCaseFileNumber}/pieces/${encodeURIComponent(piece.encodedFileId)}${suffix}`,
  }));

  return (
    <>
      <Breadcrumb
        currentPageLabel={file.originalFileName}
        segments={[
          {
            label: (
              <span className={fr.cx("fr-icon-arrow-go-back-line", "fr-link--icon-left")}>
                Tableau de bord
              </span>
            ),
            linkProps: { href: dashboardHref },
          },
          {
            label: caseFileLabel(file.caseFile.caseFileNumber, file.caseFile.title),
            linkProps: { href: caseFileHref },
          },
        ]}
      />

      <h1 className={fr.cx("fr-mb-3w")}>Édition des pièces</h1>

      <PieceNavigator pieces={pieceOptions} currentEncodedFileId={decodedFileId} />

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mb-3w")}>
        <div className={fr.cx("fr-col-12", "fr-col-lg-7")}>
          <PieceViewer
            dataUrl={dataUrl}
            mimeType={file.mimeType}
            fileName={file.originalFileName}
          />
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-lg-5")}>
          <h2>Édition de la pièce</h2>
          <PieceMetadataForm
            encodedFileId={file.encodedFileId}
            dahliaName={file.dahliaName ?? ""}
            number={file.number ?? ""}
            comment={file.comment ?? ""}
          />
          <PieceMetadata file={file} />
        </div>
      </div>
    </>
  );
}
