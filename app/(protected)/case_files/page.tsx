import { fr } from "@codegouvfr/react-dsfr";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { fetchCaseFilesTableData, HEARING_CONVOCATION_SORT_KEY } from "@/app/lib/data/case-files";
import { fetchDashboardStatusFilterOptions } from "@/app/lib/data/statuses";
import {
  CASE_FILES_DASHBOARD_COLUMNS,
  getMemoryDeadlineSource,
  type CaseFileDashboardRow,
} from "@/app/lib/case-files-dashboard-columns";
import { FACET_KEYS, DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import {
  DEFAULT_TABLE_PAGE_SIZES,
  DASHBOARD_PAGE_SIZE_COOKIE,
  parseTablePageSize,
} from "@/app/lib/table-page-size";
import { parseTableQueryState } from "@/app/lib/table-query-state";
import { statusLabelForCount } from "@/app/lib/status-label-plural";
import { resolveCurrentStatut, resolveDefaultStatut } from "@/app/lib/dashboard-filter";
import { buildCaseFilesSearchConfig } from "@/app/ui/form/case-files-search";
import { CaseFileDossierCell } from "@/app/ui/table/case-file-dossier-cell";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { MemoryDeadlineCell } from "@/app/ui/table/memory-deadline-cell";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

function setStatutSearchParam(
  params: URLSearchParams,
  statutParam: string | undefined,
  defaultStatut: string | null,
) {
  if (statutParam === undefined) {
    if (defaultStatut !== null) {
      params.set("statut", defaultStatut);
    }
  } else {
    params.set("statut", statutParam);
  }
}

function dashboardColumns(detailQueryString: string): DataTableColumn<CaseFileDashboardRow>[] {
  const suffix = detailQueryString ? `?${detailQueryString}` : "";

  return CASE_FILES_DASHBOARD_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    sortable: column.sortable,
    defaultOrder: column.defaultOrder,
    facetFields: column.facetFields,
    width: column.width,
    render: (caseFile) => {
      if (column.key === "caseFileNumber") {
        return (
          <CaseFileDossierCell
            caseFile={caseFile}
            href={`/case_files/${encodeURIComponent(caseFile.caseFileNumber)}${suffix}#case-file-details`}
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
    statut?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const {
    page: pageParam,
    sortBy: sortByParam,
    sortOrder: sortOrderParam,
    dahliaq: qParam,
    statut: statutParam,
  } = await searchParams;

  const tableState = parseTableQueryState(
    { page: pageParam, sortBy: sortByParam, sortOrder: sortOrderParam, dahliaq: qParam },
    DASHBOARD_TABLE_PARAMS,
    {
      defaultSortBy: HEARING_CONVOCATION_SORT_KEY,
      defaultOrder: sortByParam ? "descending" : "ascending",
    },
  );

  const statusFilterOptions = await fetchDashboardStatusFilterOptions();
  const defaultStatut = resolveDefaultStatut(statusFilterOptions);
  const currentStatut = resolveCurrentStatut(statutParam, defaultStatut);

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
    currentStatut,
  );

  const currentParams = new URLSearchParams();
  if (pageParam) currentParams.set("page", String(tableState.page));
  if (tableState.sortBy) currentParams.set("sortBy", tableState.sortBy);
  if (sortOrderParam) currentParams.set("sortOrder", tableState.sortOrder);
  if (tableState.query) currentParams.set("dahliaq", tableState.query);
  setStatutSearchParam(currentParams, statutParam, defaultStatut);
  const currentQueryString = currentParams.toString();

  const statutPreserve =
    statutParam === undefined
      ? defaultStatut !== null
        ? { statut: defaultStatut }
        : {}
      : statutParam !== ""
        ? { statut: statutParam }
        : { statut: "" };

  return (
    <>
      <h1 className={fr.cx("fr-mt-3w", "fr-h2")}>Affaires suivies par la DDETS du Rhône</h1>

      <DataTable
        minWidth="50rem"
        search={buildCaseFilesSearchConfig({
          statusFilterOptions,
          defaultStatut,
          currentQuery: tableState.query ?? "",
          statutParam,
          sortByParam,
          sortOrderParam,
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
          `${count} dossier${count > 1 ? "s" : ""}${currentStatut ? ` ${statusLabelForCount(count, currentStatut)}` : ""}`
        }
        preserveParams={statutPreserve}
        exportPath="/case_files/export"
      />
    </>
  );
}
