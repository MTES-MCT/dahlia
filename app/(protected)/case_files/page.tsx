import { fr } from "@codegouvfr/react-dsfr";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  fetchCaseFilesTableData,
  HEARING_CONVOCATION_SORT_KEY,
} from "@/app/lib/data/case-files";
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
import { DEFAULT_STATUT, resolveCurrentStatut } from "@/app/lib/dashboard-filter";
import { getCaseFileDisplayName } from "@/app/lib/case-file-format";
import { buildCaseFilesSearchConfig } from "@/app/ui/form/case-files-search";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { MemoryDeadlineCell } from "@/app/ui/table/memory-deadline-cell";

function setStatutSearchParam(
  params: URLSearchParams,
  statutParam: string | undefined,
  defaultStatut: string,
) {
  if (statutParam === undefined) {
    params.set("statut", defaultStatut);
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
    facet: column.facet,
    facetKey: column.facetKey,
    render: (caseFile) => {
      if (column.key === "caseFileNumber") {
        return (
          <Link
            href={`/case_files/${encodeURIComponent(caseFile.caseFileNumber)}${suffix}#case-file-details`}
          >
            {getCaseFileDisplayName(caseFile)}
          </Link>
        );
      }
      if (column.key === HEARING_CONVOCATION_SORT_KEY) {
        return (
          <MemoryDeadlineCell
            date={caseFile.memoryDeadlineDate}
            source={getMemoryDeadlineSource(caseFile)}
            status={caseFile.lastStatus.label}
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

  const currentStatut = resolveCurrentStatut(statutParam);

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
  setStatutSearchParam(currentParams, statutParam, DEFAULT_STATUT);
  const currentQueryString = currentParams.toString();

  const statutPreserve =
    statutParam === undefined
      ? { statut: DEFAULT_STATUT }
      : statutParam !== ""
        ? { statut: statutParam }
        : { statut: "" };

  return (
    <>
      <h1 className={fr.cx("fr-mt-3w", "fr-h2")}>Affaires suivies par la DDETS du Rhône</h1>

      <DataTable
        search={buildCaseFilesSearchConfig({
          defaultStatut: DEFAULT_STATUT,
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
