import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { type CaseFileEventListRow } from "@/app/lib/data/case-file-events";
import { fetchCaseFileDebugSnapshot, type CaseFileDetail } from "@/app/lib/data/case-files";
import { fetchCaseFileEventsTableData } from "@/app/lib/data/case-file-events";
import { fetchCaseFilePiecesFiltered } from "@/app/lib/data/attached-files";
import { HISTORIQUE_FACET_KEYS, HISTORIQUE_PARAMS } from "@/app/lib/historique-table";
import { PIECES_DEFAULT_ORDER, PIECES_DEFAULT_SORT_BY } from "@/app/lib/pieces-table";
import { isDebugTabEnabled, type CaseFileTabId } from "@/app/lib/case-file-tabs";
import { type CarriedSearchParams } from "@/app/lib/carried-search-params";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { CaseFileTabNav } from "@/app/ui/tabs/case-file-tab-nav";
import { RefreshCaseFileButton } from "@/app/ui/button/refresh-case-file-button";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { PiecesWorkspace, type WorkspacePiece } from "@/app/ui/pieces/pieces-workspace";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
  tab: CaseFileTabId;
  searchParams: CarriedSearchParams;
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
    facet: true,
    render: (event) => event.measure.label,
  },
  {
    key: "producteur",
    label: "Producteur",
    sortable: true,
    facet: true,
    render: (event) => (event.actor ? getActorDisplayName(event.actor) : "—"),
  },
  {
    key: "commentaire",
    label: "Commentaire",
    sortable: true,
    facet: true,
    render: (event) => event.comment ?? "—",
  },
  {
    key: "echeance",
    label: "Échéance",
    sortable: true,
    facet: true,
    render: (event) => event.deadlineLabel ?? "—",
  },
];

export async function CaseFileTabs({ caseFile, tab, searchParams }: Props) {
  const { caseFileNumber } = caseFile;
  const showDebugTab = isDebugTabEnabled(searchParams);

  const [pieces, historiqueTable, debugSnapshot] = await Promise.all([
    tab === "pieces"
      ? fetchCaseFilePiecesFiltered(
          caseFileNumber,
          PIECES_DEFAULT_SORT_BY,
          PIECES_DEFAULT_ORDER,
          null,
        )
      : null,
    tab === "historique" ? fetchCaseFileEventsTableData(caseFileNumber, searchParams) : null,
    tab === "debug" ? fetchCaseFileDebugSnapshot(caseFileNumber) : null,
  ]);

  const caseFilePath = `/case_files/${encodeURIComponent(caseFileNumber)}`;

  const workspacePieces: WorkspacePiece[] | null =
    pieces?.map((piece) => ({
      encodedFileId: piece.encodedFileId,
      number: piece.number,
      fileName: piece.fileName,
      dahliaName: piece.dahliaName,
      comment: piece.comment,
      typeLabel: piece.fileFamilyTypeLabel ?? piece.fileTypeLabel,
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
      <CaseFileTabNav selectedTabId={tab} showDebugTab={showDebugTab}>
        {tab === "pieces" && workspacePieces && (
          <PiecesWorkspace caseFileNumber={caseFileNumber} pieces={workspacePieces} />
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

        {tab === "debug" && debugSnapshot && (
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
