import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import {
  CaseFilePiece,
  fetchAttachedFile,
  fetchCaseFilePiecesFiltered,
} from "@/app/lib/data/attached-files";
import {
  PIECES_PARAMS,
  PIECES_DEFAULT_SORT_BY,
  PIECES_DEFAULT_ORDER,
} from "@/app/lib/pieces-table";
import { parseTableQueryState } from "@/app/lib/table-query-state";
import {
  pieceDisplayLabel,
  pieceDownloadFileName,
  pieceEditionHref,
} from "@/app/lib/piece-display";
import { PieceViewer } from "@/app/ui/piece-viewer";
import { PieceNavigator } from "@/app/ui/piece-navigator";
import { PieceMetadata } from "@/app/ui/piece-metadata";
import { PieceMetadataForm } from "@/app/ui/piece-metadata-form";
import { PieceCaseFileBreadcrumb } from "@/app/ui/breadcrumb/piece-case-file-breadcrumb";

type Props = {
  params: Promise<{ caseFileNumber: string; encodedFileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { caseFileNumber, encodedFileId } = await params;
  const decodedCaseFileNumber = decodeURIComponent(caseFileNumber);
  const decodedFileId = decodeURIComponent(encodedFileId);

  const file = await fetchAttachedFile(decodedFileId);
  if (!file || file.caseFileNumber !== decodedCaseFileNumber) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const carriedParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") carriedParams.set(key, value);
  }
  const queryString = carriedParams.toString();

  const encodedCaseFileNumber = encodeURIComponent(decodedCaseFileNumber);
  const dataUrl = `/case_files/${encodedCaseFileNumber}/pieces/${encodeURIComponent(decodedFileId)}/data`;

  // Outside production the data route serves a mocked PDF regardless of the real
  // pièce type, so the viewer must render it as a PDF even when the original
  // file was an image.
  const viewerMimeType =
    process.env.ENVIRONMENT !== "production" ? "application/pdf" : file.mimeType;

  const piecesState = parseTableQueryState(resolvedSearchParams, PIECES_PARAMS, {
    defaultSortBy: PIECES_DEFAULT_SORT_BY,
    defaultOrder: PIECES_DEFAULT_ORDER,
  });

  const orderedPieces = await fetchCaseFilePiecesFiltered(
    decodedCaseFileNumber,
    piecesState.sortBy,
    piecesState.sortOrder,
    piecesState.query,
  );

  const pieceOptions = orderedPieces.map((piece) => ({
    encodedFileId: piece.encodedFileId,
    label: pieceDisplayLabel(piece),
    href: pieceEditionHref({
      caseFileNumber: decodedCaseFileNumber,
      encodedFileId: piece.encodedFileId,
      queryString,
    }),
  }));

  return (
    <>
      <PieceCaseFileBreadcrumb piece={file} searchParams={resolvedSearchParams} />

      <h1 className={fr.cx("fr-mb-3w")}>Édition des pièces</h1>

      <PieceNavigator pieces={pieceOptions} currentEncodedFileId={decodedFileId} />

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mb-3w")}>
        <div className={fr.cx("fr-col-12", "fr-col-lg-7")}>
          <PieceViewer
            dataUrl={dataUrl}
            mimeType={viewerMimeType}
            fileName={pieceDownloadFileName(file)}
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
