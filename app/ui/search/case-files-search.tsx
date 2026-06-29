import clsx from "clsx";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { buildDashboardSortHiddenParams } from "@/app/lib/table-search-context";
import { CaseFilesSearchByStatus } from "@/app/ui/search/case-files-search-by-status";
import { type DataTableSearchConfig } from "@/app/ui/table/data-table";
import { TableSearchBar } from "@/app/ui/table/table-search-bar";

const PLACEHOLDER = 'ex. « dupont » ou « requerant:prefet defendeur:"jean dupont" »';

export type CaseFilesSearchProps = {
  // Status options and the label preselected when `statut` is absent from the URL.
  statusOptions: string[];
  defaultStatut: string;
  // Current text query, used as the input default value.
  currentQuery: string;
  // Raw `statut`/`sortBy`/`sortOrder` params: `statut` drives the select's selected
  // value, the sort params are mirrored as hidden fields so a search keeps the
  // current ordering.
  statutParam?: string;
  sortByParam?: string;
  sortOrderParam?: string;
};

function caseFilesSearchSlot({
  statusOptions,
  defaultStatut,
  currentQuery,
  statutParam,
}: Pick<CaseFilesSearchProps, "statusOptions" | "defaultStatut" | "currentQuery" | "statutParam">) {
  return (
    <div className={clsx("flex", "flex-row", "gap-2", "items-end")}>
      <CaseFilesSearchByStatus
        // Force a remount when the status param changes so the uncontrolled
        // <select> picks up its new defaultValue on client navigation (e.g.
        // the reset link); without this, React keeps the stale DOM value.
        key={`statut-${statutParam ?? "__default__"}`}
        options={statusOptions}
        defaultStatut={defaultStatut}
        statutParam={statutParam}
      />
      <TableSearchBar
        key={currentQuery}
        name={DASHBOARD_TABLE_PARAMS.query}
        label="Rechercher"
        defaultValue={currentQuery}
        placeholder={PLACEHOLDER}
        className={clsx("fr-mb-3w", "flex-1")}
      />
    </div>
  );
}

export function buildCaseFilesSearchConfig({
  statusOptions,
  defaultStatut,
  currentQuery,
  statutParam,
  sortByParam,
  sortOrderParam,
}: CaseFilesSearchProps): DataTableSearchConfig {
  return {
    action: "/case_files",
    currentQuery,
    hiddenParams: buildDashboardSortHiddenParams(sortByParam, sortOrderParam),
    resetHref: "/case_files",
    label: "Rechercher un dossier",
    placeholder: PLACEHOLDER,
    searchSlot: caseFilesSearchSlot({
      statusOptions,
      defaultStatut,
      currentQuery,
      statutParam,
    }),
  };
}
