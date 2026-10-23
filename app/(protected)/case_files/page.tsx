import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getCurrentCaseFileScope } from "@/app/lib/case-file-scope";
import { fetchCaseFilesTableData, HEARING_CONVOCATION_SORT_KEY } from "@/app/lib/data/case-files";
import { fetchDashboardStatusFilterOptions } from "@/app/lib/data/statuses";
import { fetchTagOptions } from "@/app/lib/data/tags";
import {
  CASE_FILES_DASHBOARD_COLUMNS,
  getMemoryDeadlineSource,
  type CaseFileDashboardRow,
} from "@/app/lib/case-files-dashboard-columns";
import {
  FACET_KEYS,
  DASHBOARD_TABLE_PARAMS,
  STATUS_FACET_FIELD,
  getFacetValue,
  resolveFacetFieldValue,
  type FacetField,
} from "@/app/lib/case-file-search";
import {
  DEFAULT_TABLE_PAGE_SIZES,
  DASHBOARD_PAGE_SIZE_COOKIE,
  parseTablePageSize,
} from "@/app/lib/table-page-size";
import { parseTableQueryState } from "@/app/lib/table-query-state";
import { statusLabelForCount } from "@/app/lib/status-label-plural";
import {
  filterStatusOptionsByGroup,
  resolveStatusGroup,
  type StatusGroup,
} from "@/app/lib/dashboard-filter";
import { buildCaseFilesSearchConfig } from "@/app/ui/form/case-files-search";
import { CaseFilesStatusGroupToggle } from "@/app/ui/form/case-files-status-group-toggle";
import { caseFileHref } from "@/app/lib/case-file-key";
import { CaseFileDossierCell } from "@/app/ui/table/case-file-dossier-cell";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { MemoryDeadlineCell } from "@/app/ui/table/memory-deadline-cell";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

const PAGE_HEADING = "Vos dossiers";

// Caption suffix when no single status is selected, so the count still tells
// which group it covers.
function statusGroupCaptionSuffix(group: StatusGroup, count: number): string {
  if (group === "en_cours") return " en cours";
  if (group === "termine") return ` terminé${count > 1 ? "s" : ""}`;
  return "";
}

// Every dashboard facet, in column order, with the status facet offering the
// given options (status labels of the selected group) as a select.
function dashboardFacetFields(statusOptions: readonly string[]): FacetField[] {
  return CASE_FILES_DASHBOARD_COLUMNS.flatMap((column) => column.facetFields ?? []).map((field) =>
    field.key === STATUS_FACET_FIELD.key ? { ...field, options: statusOptions } : field,
  );
}

// Columns carry no facet filter: every facet lives in the « Filtres avancés »
// panel of the search form.
function dashboardColumns(detailQueryString: string): DataTableColumn<CaseFileDashboardRow>[] {
  const suffix = detailQueryString ? `?${detailQueryString}` : "";

  return CASE_FILES_DASHBOARD_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    sortable: column.sortable,
    defaultOrder: column.defaultOrder,
    width: column.width,
    render: (caseFile) => {
      if (column.key === "caseFileNumber") {
        return (
          <CaseFileDossierCell
            caseFile={caseFile}
            href={caseFileHref(caseFile, `${suffix}#case-file-details`)}
          />
        );
      }
      if (column.key === HEARING_CONVOCATION_SORT_KEY) {
        return (
          <MemoryDeadlineCell
            date={caseFile.memoryDeadlineDate}
            source={getMemoryDeadlineSource(caseFile)}
          />
        );
      }
      return column.exportValue(caseFile);
    },
  }));
}

type Props = {
  searchParams: Promise<{
    page?: string;
    sortBy: string;
    sortOrder: string;
    dahliaq?: string;
    groupe?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  // A validated user whose permission scope holds no jurisdiction would face an
  // empty table with no explanation: tell them what to do instead.
  const scope = await getCurrentCaseFileScope();
  if (!scope.unrestricted && scope.jurisdictionIds.length === 0) {
    return (
      <>
        <h1 className={fr.cx("fr-mt-3w", "fr-h2")}>{PAGE_HEADING}</h1>
        <Alert
          severity="info"
          title="Aucune juridiction ne vous est attribuée"
          description="Contactez un administrateur pour accéder aux dossiers."
        />
      </>
    );
  }

  const {
    page: pageParam,
    sortBy: sortByParam,
    sortOrder: sortOrderParam,
    dahliaq: qParam,
    groupe: groupeParam,
  } = await searchParams;

  const tableState = parseTableQueryState(
    { page: pageParam, sortBy: sortByParam, sortOrder: sortOrderParam, dahliaq: qParam },
    DASHBOARD_TABLE_PARAMS,
    {
      defaultSortBy: HEARING_CONVOCATION_SORT_KEY,
      defaultOrder: sortByParam ? "descending" : "ascending",
    },
  );

  const [statusFilterOptions, tagOptions] = await Promise.all([
    fetchDashboardStatusFilterOptions(),
    fetchTagOptions(),
  ]);
  const group = resolveStatusGroup(groupeParam);
  const groupStatusOptions = filterStatusOptionsByGroup(statusFilterOptions, group);
  const statusFacet = getFacetValue(tableState.query ?? "", STATUS_FACET_FIELD.key);
  const currentStatut =
    resolveFacetFieldValue({ ...STATUS_FACET_FIELD, options: groupStatusOptions }, statusFacet) ||
    null;

  const cookieStore = await cookies();
  const pageSize = parseTablePageSize(
    cookieStore.get(DASHBOARD_PAGE_SIZE_COOKIE)?.value,
    DEFAULT_TABLE_PAGE_SIZES.dashboard,
  );

  const { rows, totalPages, totalCount } = await fetchCaseFilesTableData(
    tableState.page,
    pageSize,
    tableState.sortBy,
    tableState.sortOrder,
    tableState.query,
    null,
    group,
  );

  const currentParams = new URLSearchParams();
  if (pageParam) currentParams.set("page", String(tableState.page));
  if (tableState.sortBy) currentParams.set("sortBy", tableState.sortBy);
  if (sortOrderParam) currentParams.set("sortOrder", tableState.sortOrder);
  if (tableState.query) currentParams.set("dahliaq", tableState.query);
  if (groupeParam !== undefined) currentParams.set("groupe", group);
  const currentQueryString = currentParams.toString();

  return (
    <>
      <div
        className={clsx(
          "flex",
          "flex-wrap",
          "items-center",
          "gap-x-8",
          "gap-y-4",
          fr.cx("fr-mt-3w", "fr-mb-3w"),
        )}
      >
        <h1 className={fr.cx("fr-h2", "fr-mb-0")}>{PAGE_HEADING}</h1>
        <CaseFilesStatusGroupToggle key={group} currentGroup={group} />
      </div>

      <DataTable
        minWidth="50rem"
        search={buildCaseFilesSearchConfig({
          currentQuery: tableState.query ?? "",
          sortByParam,
          sortOrderParam,
          statusGroup: group,
          facetFields: dashboardFacetFields(groupStatusOptions),
          availableTags: tagOptions,
        })}
        columns={dashboardColumns(currentQueryString)}
        rows={rows}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={tableState.page}
        pageSize={pageSize}
        params={DASHBOARD_TABLE_PARAMS}
        tableId="dashboard"
        facetKeys={FACET_KEYS}
        caption={(count) =>
          `${count} dossier${count > 1 ? "s" : ""}${currentStatut ? ` ${statusLabelForCount(count, currentStatut)}` : statusGroupCaptionSuffix(group, count)}`
        }
        exportPath="/case_files/export"
      />
    </>
  );
}
