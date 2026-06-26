import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { fetchAttachedFile, fetchCaseFilePieces } from "@/app/lib/data/attached-files";
import { formatDateFr } from "@/app/lib/case-file-format";
import { queryTableRows, type SortOrder } from "@/app/lib/table-query";
import {
  PIECES_PARAMS,
  PIECES_DEFAULT_SORT_BY,
  PIECES_DEFAULT_ORDER,
  piecesQueryColumns,
} from "@/app/lib/pieces-table";
import { PieceViewer } from "@/app/ui/piece-viewer";
import { PieceNavigator } from "@/app/ui/piece-navigator";

type Props = {
  params: Promise<{ caseFileNumber: string; encodedFileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Label for the case file in the breadcrumb: number + optional title.
function caseFileLabel(caseFileNumber: string, title: string | null): string {
  return caseFileNumber + (title ? ` - ${title}` : "");
}

// A read-only DSFR field used to display one metadata value of the pièce.
function MetadataField({ label, value }: { label: string; value: string }) {
  return (
    <Input
      label={label}
      nativeInputProps={{ value: value || "—", readOnly: true }}
      className={fr.cx("fr-mb-2w")}
    />
  );
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
    label: piece.originalFileName,
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

      <h1 className={fr.cx("fr-h4", "fr-mb-3w")}>Édition des pièces</h1>

      <PieceNavigator pieces={pieceOptions} currentEncodedFileId={decodedFileId} />

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <div className={fr.cx("fr-col-12", "fr-col-lg-7")}>
          <PieceViewer dataUrl={dataUrl} mimeType={file.mimeType} fileName={file.originalFileName} />
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-lg-5")}>
          <form>
            <fieldset className={fr.cx("fr-fieldset")} style={{ border: "none", padding: 0 }}>
              <legend className={fr.cx("fr-h6")}>Métadonnées de la pièce</legend>
              <MetadataField label="Nom du fichier" value={file.originalFileName} />
              <MetadataField label="Type de pièce" value={file.fileTypeLabel} />
              <MetadataField label="Famille de pièce" value={file.fileFamilyType.label} />
              <MetadataField label="Type de document" value={file.documentType} />
              <MetadataField label="Format (MIME)" value={file.mimeType} />
              <MetadataField label="Date de création" value={formatDateFr(file.eventCreationDate)} />
              <MetadataField label="Identifiant Télérecours" value={file.encodedFileId} />
            </fieldset>
          </form>
        </div>
      </div>
    </>
  );
}
