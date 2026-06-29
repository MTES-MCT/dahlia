import { fr } from "@codegouvfr/react-dsfr";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { type CaseFileEventListRow } from "@/app/lib/data/case-file-events";
import { type CaseFilePiece } from "@/app/lib/data/attached-files";
import { fetchCaseFileDebugSnapshot, type CaseFileDetail } from "@/app/lib/data/case-files";
import { fetchCaseFileEventsTableData } from "@/app/lib/data/case-file-events";
import { fetchCaseFilePiecesTableData } from "@/app/lib/data/attached-files";
import { HISTORIQUE_FACET_KEYS, HISTORIQUE_PARAMS } from "@/app/lib/historique-table";
import { PIECES_FACET_KEYS, PIECES_PARAMS } from "@/app/lib/pieces-table";
import { type CaseFileTabId } from "@/app/lib/case-file-tabs";
import { buildBackParams, type CarriedSearchParams } from "@/app/lib/carried-search-params";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { CaseFileTabNav } from "@/app/ui/tabs/case-file-tab-nav";
import { RefreshCaseFileButton } from "@/app/ui/refresh-case-file-button";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { renderPieceNameCell, renderPieceTypeCell } from "@/app/ui/table/piece-table-cells";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
  tab: CaseFileTabId;
  searchParams: CarriedSearchParams;
};

function piecesColumns(
  caseFileNumber: string,
  queryString: string,
): DataTableColumn<CaseFilePiece>[] {
  return [
    {
      key: "nom",
      label: "Nom",
      sortable: true,
      facet: true,
      render: (piece) => renderPieceNameCell(piece, caseFileNumber, queryString),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      facet: true,
      render: renderPieceTypeCell,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      defaultOrder: "descending",
      render: (piece) => formatDateFr(piece.eventCreationDate),
    },
  ];
}

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

  const [piecesTable, historiqueTable, debugSnapshot] = await Promise.all([
    tab === "pieces" ? fetchCaseFilePiecesTableData(caseFileNumber, searchParams) : null,
    tab === "historique" ? fetchCaseFileEventsTableData(caseFileNumber, searchParams) : null,
    tab === "debug" ? fetchCaseFileDebugSnapshot(caseFileNumber) : null,
  ]);

  const queryString = buildBackParams(searchParams).toString();
  const caseFilePath = `/case_files/${encodeURIComponent(caseFileNumber)}`;

  return (
    <CaseFileTabNav selectedTabId={tab}>
      {tab === "pieces" && piecesTable && (
        <DataTable
          columns={piecesColumns(caseFileNumber, queryString)}
          rows={piecesTable.rows}
          totalCount={piecesTable.totalCount}
          totalPages={piecesTable.totalPages}
          currentPage={piecesTable.currentPage}
          pageSize={piecesTable.pageSize}
          params={PIECES_PARAMS}
          tableId="pieces"
          facetKeys={PIECES_FACET_KEYS}
          caption={(count) => `${count} pièce${count > 1 ? "s" : ""}`}
          search={{
            ...buildTableSearchContext(searchParams, PIECES_PARAMS, caseFilePath),
            label: "Rechercher une pièce",
            placeholder: 'ex. « requête » ou « type:pdf nom:"acte" »',
          }}
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
  );
}
