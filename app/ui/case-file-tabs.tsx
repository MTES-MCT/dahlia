"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { ClientTable, type ClientTableColumn } from "@/app/ui/client-table";
import { type SortOrder } from "@/app/lib/table-query";
import { pieceEditionHref } from "@/app/lib/piece-display";
import { PIECES_PARAMS, piecesQueryColumns } from "@/app/lib/pieces-table";
import type { CaseFileDetail } from "@/app/lib/data/case-files";

type CaseFile = NonNullable<CaseFileDetail>;
type Piece = CaseFile["attachedFiles"][number];
type CaseEvent = CaseFile["events"][number];

type Props = {
  // The page calls notFound() when the case file is missing, so here it is always defined.
  caseFile: CaseFile;
};

type TabId = "pieces" | "historique" | "debug";

const TAB_IDS: TabId[] = ["pieces", "historique", "debug"];
const DEFAULT_TAB: TabId = "pieces";

const PAGE_SIZE = 10;

// Prefixed URL params so the two tables (and the tab selection) coexist in a
// single query string without colliding, and survive tab switches / refresh.
// The pièces params are shared with the pièce edition page via `pieces-table.ts`.
const HISTORIQUE_PARAMS: TableParamNames = {
  page: "hiPage",
  sortBy: "hiSort",
  sortOrder: "hiOrder",
  query: "hiq",
};

// Display concerns layered on top of the shared `piecesQueryColumns` query
// config (matched by key): header label, sort control, and cell rendering.
const PIECES_COLUMN_DISPLAY: Record<
  string,
  { label: string; defaultOrder?: SortOrder; render?: (piece: Piece) => React.ReactNode }
> = {
  nom: { label: "Nom" },
  type: { label: "Type" },
  date: { label: "Date", defaultOrder: "descending" },
  format: { label: "Format" },
  proprietaire: {
    label: "Propriétaire",
    render: (piece) => (piece.event?.actor ? getActorDisplayName(piece.event.actor) : "—"),
  },
};

// Attached files: free text searches Nom + Type; Nom/Type/Format are filterable
// facets; default sort by date, most recent first. Built from the shared query
// columns so the pièce edition page rebuilds the exact same ordered list.
function createPiecesColumns(pieceHref: (piece: Piece) => string): ClientTableColumn<Piece>[] {
  return piecesQueryColumns.map((column) => {
    const display = PIECES_COLUMN_DISPLAY[column.key];
    const render =
      column.key === "nom"
        ? (file: Piece) =>
            file.dahliaName ? (
              <div>
                <Link href={pieceHref(file)} className={fr.cx("fr-link")}>
                  {file.dahliaName}
                </Link>
                <div className={`${fr.cx("fr-text--sm")} text-grey italic`}>
                  {file.originalFileName}
                </div>
              </div>
            ) : (
              <Link href={pieceHref(file)} className={fr.cx("fr-link")}>
                {file.originalFileName}
              </Link>
            )
        : display.render;
    return {
      ...column,
      label: display.label,
      sortable: true,
      defaultOrder: display.defaultOrder,
      render,
    } satisfies ClientTableColumn<Piece>;
  });
}

// History events: free text searches Événement + Commentaire; those plus
// Échéance are filterable; default sort by date, most recent first.
const HISTORIQUE_COLUMNS: ClientTableColumn<CaseEvent>[] = [
  {
    key: "date",
    label: "Date",
    text: (event) => formatDateFr(event.eventDate),
    sortValue: (event) => event.eventDate,
    sortable: true,
    defaultOrder: "descending",
  },
  {
    key: "evenement",
    label: "Événement",
    text: (event) => event.measure.label,
    sortValue: (event) => event.measure.label,
    searchable: true,
    facet: true,
    sortable: true,
  },
  {
    key: "producteur",
    label: "Producteur",
    text: (event) => (event.actor ? getActorDisplayName(event.actor) : ""),
    sortValue: (event) => (event.actor ? getActorDisplayName(event.actor) : ""),
    render: (event) => (event.actor ? getActorDisplayName(event.actor) : "—"),
    searchable: true,
    facet: true,
    sortable: true,
  },
  {
    key: "commentaire",
    label: "Commentaire",
    text: (event) => event.comment ?? "",
    sortValue: (event) => event.comment ?? "",
    render: (event) => event.comment ?? "—",
    searchable: true,
    facet: true,
    sortable: true,
  },
  {
    key: "echeance",
    label: "Échéance",
    text: (event) => event.deadlineLabel ?? "",
    sortValue: (event) => event.deadlineLabel ?? "",
    render: (event) => event.deadlineLabel ?? "—",
    facet: true,
    sortable: true,
  },
];

export function CaseFileTabs({ caseFile }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The selected tab lives in the URL (?tab=…) so it survives refresh, is
  // shareable, and works with the browser back button. Fall back to the
  // default tab when the param is missing or not a known tab id.
  const tabParam = searchParams.get("tab");
  const selectedTabId: TabId = TAB_IDS.includes(tabParam as TabId)
    ? (tabParam as TabId)
    : DEFAULT_TAB;

  function handleTabChange(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  // Link a pièce row to its edition page, carrying the current query string so
  // the breadcrumb can restore the dashboard and the case file as they are now.
  const currentQuery = searchParams.toString();
  const pieceHref = (piece: Piece) =>
    pieceEditionHref({
      caseFileNumber: caseFile.caseFileNumber,
      encodedFileId: piece.encodedFileId,
      queryString: currentQuery || undefined,
    });

  return (
    <Tabs
      selectedTabId={selectedTabId}
      onTabChange={handleTabChange}
      tabs={[
        { tabId: "pieces", label: "Pièces" },
        { tabId: "historique", label: "Historique" },
        { tabId: "debug", label: "Debug" },
      ]}
      className={fr.cx("fr-mb-3w")}
    >
      {selectedTabId === "pieces" && (
        <ClientTable
          rows={caseFile.attachedFiles}
          columns={createPiecesColumns(pieceHref)}
          params={PIECES_PARAMS}
          pageSize={PAGE_SIZE}
          caption={(count) => `${count} pièce${count > 1 ? "s" : ""}`}
          defaultSortBy="date"
          defaultOrder="descending"
          searchLabel="Rechercher une pièce"
          searchPlaceholder='ex. « requête » ou « type:pdf nom:"acte" »'
        />
      )}

      {selectedTabId === "historique" && (
        <ClientTable
          rows={caseFile.events}
          columns={HISTORIQUE_COLUMNS}
          params={HISTORIQUE_PARAMS}
          pageSize={PAGE_SIZE}
          caption={(count) => `${count} événement${count > 1 ? "s" : ""}`}
          defaultSortBy="date"
          defaultOrder="descending"
          searchLabel="Rechercher un événement"
          searchPlaceholder="ex. « audience » ou « evenement:requête »"
        />
      )}

      {selectedTabId === "debug" && (
        <pre
          className={fr.cx("fr-p-2w")}
          style={{
            overflowX: "auto",
            backgroundColor: "var(--background-alt-grey)",
            borderRadius: "0.5rem",
          }}
        >
          {JSON.stringify(caseFile, null, 2)}
        </pre>
      )}
    </Tabs>
  );
}
