import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { caseFileHref } from "@/app/lib/case-file-key";
import { formatDateFr, formatDateTimeFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { type CaseFileEventListRow } from "@/app/lib/data/case-file-events";
import { fetchCaseFileDebugSnapshot, type CaseFileDetail } from "@/app/lib/data/case-files";
import { fetchCaseFileEventsTableData } from "@/app/lib/data/case-file-events";
import { fetchCaseFilePiecesFiltered, fetchCommentedPieces } from "@/app/lib/data/attached-files";
import { fetchRelatedCaseFiles } from "@/app/lib/data/related-case-files";
import { HISTORIQUE_FACET_KEYS, HISTORIQUE_PARAMS } from "@/app/lib/historique-table";
import { PIECES_DEFAULT_ORDER, PIECES_DEFAULT_SORT_BY } from "@/app/lib/pieces-table";
import {
  isDebugTabEnabled,
  PIECE_PARAM,
  pieceTabSuffix,
  type CaseFileTabId,
} from "@/app/lib/case-file-tabs";
import { type CarriedSearchParams } from "@/app/lib/carried-search-params";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { CaseFileTabNav } from "@/app/ui/tabs/case-file-tab-nav";
import { RefreshCaseFileButton } from "@/app/ui/button/refresh-case-file-button";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { PiecesWorkspace, type WorkspacePiece } from "@/app/ui/pieces/pieces-workspace";
import { CaseFileInfoPanel } from "@/app/ui/case-file/case-file-info-panel";
import { CaseFileCommentsPanel } from "@/app/ui/case-file/case-file-comments-panel";
import { CaseFileQualificationPanel } from "@/app/ui/case-file/case-file-qualification-panel";
import {
  getFieldsToReview,
  getLastClassifierChangeAt,
  getQualificationReviewState,
} from "@/app/lib/case-file-qualification";
import { toCaseFileTagViews, type CaseFileTagView } from "@/app/lib/case-file-tags";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
  tab: CaseFileTabId;
  searchParams: CarriedSearchParams;
  // Full tag catalogue, for the qualification block of the synthèse tab.
  availableTags?: CaseFileTagView[];
  isAdmin?: boolean;
};

const HISTORIQUE_COLUMNS: DataTableColumn<CaseFileEventListRow>[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    defaultOrder: "descending",
    render: (event) => formatDateFr(event.eventDate),
  },
  {
    key: "evenement",
    label: "Événement",
    sortable: true,
    facetFields: [{ key: "evenement", label: "Événement" }],
    render: (event) => event.measure.label,
  },
  {
    key: "producteur",
    label: "Producteur",
    sortable: true,
    facetFields: [{ key: "producteur", label: "Producteur" }],
    render: (event) => (event.actor ? getActorDisplayName(event.actor) : "—"),
  },
  {
    key: "commentaire",
    label: "Commentaire",
    sortable: true,
    facetFields: [{ key: "commentaire", label: "Commentaire" }],
    render: (event) => event.comment ?? "—",
  },
  {
    key: "echeance",
    label: "Échéance",
    sortable: true,
    facetFields: [{ key: "echeance", label: "Échéance" }],
    render: (event) => event.deadlineLabel ?? "—",
  },
];

export async function CaseFileTabs({
  caseFile,
  tab,
  searchParams,
  availableTags = [],
  isAdmin = false,
}: Props) {
  const caseFileKey = {
    jurisdictionCode: caseFile.jurisdictionCode,
    caseFileNumber: caseFile.caseFileNumber,
  };
  const showDebugTab = isDebugTabEnabled(searchParams, isAdmin);

  const [relatedCaseFiles, commentedPieces, pieces, historiqueTable, debugSnapshot] =
    await Promise.all([
      tab === "synthese" ? fetchRelatedCaseFiles(caseFileKey) : null,
      tab === "synthese" ? fetchCommentedPieces(caseFileKey) : null,
      tab === "pieces"
        ? fetchCaseFilePiecesFiltered(
            caseFileKey,
            PIECES_DEFAULT_SORT_BY,
            PIECES_DEFAULT_ORDER,
            null,
          )
        : null,
      tab === "historique" ? fetchCaseFileEventsTableData(caseFileKey, searchParams) : null,
      tab === "debug" && showDebugTab ? fetchCaseFileDebugSnapshot(caseFileKey) : null,
    ]);

  const caseFilePath = caseFileHref(caseFileKey);

  const workspacePieces: WorkspacePiece[] | null =
    pieces?.map((piece) => ({
      encodedFileId: piece.encodedFileId,
      number: piece.number,
      fileName: piece.fileName,
      dahliaName: piece.dahliaName,
      comment: piece.comment,
      typeLabel: piece.fileTypeLabel,
      dataUrl: `${caseFilePath}/pieces/${encodeURIComponent(piece.encodedFileId)}/data`,
      // Outside production the data route serves a mocked PDF regardless of the
      // real pièce type, so the viewer must render it as a PDF.
      viewerMimeType:
        process.env.ENVIRONMENT !== "production"
          ? "application/pdf"
          : (piece.mimeType ?? "application/octet-stream"),
    })) ?? null;

  return (
    <div
      className={clsx(
        "flex",
        "flex-1",
        "flex-col",
        tab === "pieces" && clsx("overflow-hidden", "pieces-fill"),
      )}
    >
      <CaseFileTabNav
        selectedTabId={tab}
        eventCount={caseFile._count.events}
        pieceCount={caseFile._count.attachedFiles}
        showDebugTab={showDebugTab}
      >
        {tab === "synthese" && relatedCaseFiles && (
          <>
            <CaseFileInfoPanel caseFile={caseFile} relatedCaseFiles={relatedCaseFiles} />
            <CaseFileQualificationPanel
              jurisdictionCode={caseFile.jurisdictionCode}
              caseFileNumber={caseFile.caseFileNumber}
              statusLabel={caseFile.lastStatus.label}
              litigationType={caseFile.litigationType}
              rightType={caseFile.rightType}
              comDaloNumber={caseFile.comDaloNumber}
              comedDecisionDate={caseFile.comedDecisionDate}
              productionDeadlineType={caseFile.productionDeadlineType}
              productionDeadlineDate={caseFile.productionDeadlineDate}
              tags={toCaseFileTagViews(caseFile.caseFileTags)}
              availableTags={availableTags}
              reviewState={getQualificationReviewState(
                caseFile.qualificationValidatedAt,
                getLastClassifierChangeAt(caseFile.classificationFieldChanges),
              )}
              fieldsToReview={getFieldsToReview(
                caseFile.qualificationValidatedAt,
                caseFile.classificationFieldChanges,
              )}
              validatedAtLabel={formatDateTimeFr(caseFile.qualificationValidatedAt)}
            />
            <CaseFileCommentsPanel
              jurisdictionCode={caseFile.jurisdictionCode}
              caseFileNumber={caseFile.caseFileNumber}
              comment={caseFile.comment}
              pieceComments={(commentedPieces ?? []).map((piece) => ({
                encodedFileId: piece.encodedFileId,
                name: piece.dahliaName ?? piece.fileName,
                comment: piece.comment ?? "",
                href: caseFileHref(caseFileKey, pieceTabSuffix(piece.encodedFileId)),
              }))}
            />
          </>
        )}

        {tab === "pieces" && workspacePieces && (
          <PiecesWorkspace
            caseFileKey={caseFileKey}
            pieces={workspacePieces}
            initialPieceId={
              typeof searchParams[PIECE_PARAM] === "string" ? searchParams[PIECE_PARAM] : undefined
            }
          />
        )}

        {tab === "historique" && historiqueTable && (
          <DataTable
            columns={HISTORIQUE_COLUMNS}
            rows={historiqueTable.rows}
            totalCount={historiqueTable.totalCount}
            totalPages={historiqueTable.totalPages}
            currentPage={historiqueTable.currentPage}
            pageSize={historiqueTable.pageSize}
            params={HISTORIQUE_PARAMS}
            tableId="historique"
            facetKeys={HISTORIQUE_FACET_KEYS}
            caption={(count) => `${count} événement${count > 1 ? "s" : ""}`}
            search={{
              ...buildTableSearchContext(searchParams, HISTORIQUE_PARAMS, caseFilePath),
              label: "Rechercher un événement",
              placeholder: "ex. « audience » ou « evenement:requête »",
            }}
          />
        )}

        {showDebugTab && tab === "debug" && debugSnapshot && (
          <>
            <RefreshCaseFileButton caseFile={caseFile} />
            <pre
              className={fr.cx("fr-p-2w")}
              style={{
                overflowX: "auto",
                backgroundColor: "var(--background-alt-grey)",
                borderRadius: "0.5rem",
              }}
            >
              {JSON.stringify(debugSnapshot, null, 2)}
            </pre>
          </>
        )}
      </CaseFileTabNav>
    </div>
  );
}
