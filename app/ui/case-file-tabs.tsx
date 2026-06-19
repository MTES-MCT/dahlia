"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { formatDateFr } from "@/app/lib/case-file-format";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { ClientTable, type ClientTableColumn } from "@/app/ui/client-table";
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
const PIECES_PARAMS: TableParamNames = {
  page: "pcPage",
  sortBy: "pcSort",
  sortOrder: "pcOrder",
  query: "pcq",
};
const HISTORIQUE_PARAMS: TableParamNames = {
  page: "hiPage",
  sortBy: "hiSort",
  sortOrder: "hiOrder",
  query: "hiq",
};

// Attached files: free text searches Nom + Type; Nom/Type/Format are filterable
// facets; default sort by date, most recent first.
const PIECES_COLUMNS: ClientTableColumn<Piece>[] = [
  {
    key: "nom",
    label: "Nom",
    text: (file) => file.originalFileName,
    sortValue: (file) => file.originalFileName,
    searchable: true,
    facet: true,
    sortable: true,
  },
  {
    key: "type",
    label: "Type",
    text: (file) => file.fileTypeLabel,
    sortValue: (file) => file.fileTypeLabel,
    searchable: true,
    facet: true,
    sortable: true,
  },
  {
    key: "date",
    label: "Date",
    text: (file) => formatDateFr(file.eventCreationDate),
    sortValue: (file) => file.eventCreationDate,
    sortable: true,
    defaultOrder: "descending",
  },
  {
    key: "format",
    label: "Format",
    text: (file) => file.mimeType,
    sortValue: (file) => file.mimeType,
    facet: true,
    sortable: true,
  },
];

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
          columns={PIECES_COLUMNS}
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
