import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { type StatusGroup } from "@/app/lib/dashboard-filter";
import { buildDashboardSortHiddenParams } from "@/app/lib/table-search-context";
import { type FacetField } from "@/app/ui/button/column-filter-button";
import { CaseFilesSearchFields } from "@/app/ui/form/case-files-search-fields";
import { SaveCurrentSearchButton } from "@/app/ui/form/saved-searches";
import { type DataTableSearchConfig } from "@/app/ui/table/data-table";

const PLACEHOLDER = "ex. « dupont » ou « 2603576 »";

export type CaseFilesSearchProps = {
  // Current text query, used as the input default value.
  currentQuery: string;
  // Raw `sortBy`/`sortOrder` params, mirrored as hidden fields so a search keeps
  // the current ordering.
  sortByParam?: string;
  sortOrderParam?: string;
  // Status group selected by the toggle, mirrored as a hidden field so a search
  // stays within the group.
  statusGroup?: StatusGroup;
  // Facets offered in the « Filtres avancés » panel (status options included).
  facetFields?: readonly FacetField[];
  // Tag catalogue offered by the « Mots-clés » combobox of the panel.
  availableTags?: readonly CaseFileTagView[];
};

export function buildCaseFilesSearchConfig({
  currentQuery,
  sortByParam,
  sortOrderParam,
  statusGroup,
  facetFields = [],
  availableTags,
}: CaseFilesSearchProps): DataTableSearchConfig {
  return {
    action: "/case_files",
    currentQuery,
    hiddenParams: [
      ...buildDashboardSortHiddenParams(sortByParam, sortOrderParam),
      ...(statusGroup ? [{ name: "groupe", value: statusGroup }] : []),
    ],
    label: "Rechercher un dossier",
    placeholder: PLACEHOLDER,
    // Bordered light grey frame around the whole search, submit bar included.
    className: clsx(
      "border border-solid border-(--border-default-grey) bg-(--background-alt-grey)",
      fr.cx("fr-p-3w"),
    ),
    searchSlot: (
      // Remount on navigation so the fields re-seed from the new URL query.
      <CaseFilesSearchFields
        key={currentQuery}
        initialQuery={currentQuery}
        facetFields={facetFields}
        availableTags={availableTags}
        name={DASHBOARD_TABLE_PARAMS.query}
        placeholder={PLACEHOLDER}
      />
    ),
    actionsSlot: <SaveCurrentSearchButton />,
  };
}
