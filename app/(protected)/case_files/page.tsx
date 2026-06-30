import { fr } from "@codegouvfr/react-dsfr";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  fetchCaseFilesTableData,
  fetchUsedStatusLabels,
  HEARING_CONVOCATION_SORT_KEY,
} from "@/app/lib/data/case-files";
import { FACET_KEYS, DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import {
  DEFAULT_TABLE_PAGE_SIZES,
  DASHBOARD_PAGE_SIZE_COOKIE,
  parseTablePageSize,
} from "@/app/lib/table-page-size";
import { parseTableQueryState } from "@/app/lib/table-query-state";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { statusLabelForCount } from "@/app/lib/status-label-plural";
import { DEFAULT_STATUT, resolveCurrentStatut } from "@/app/lib/dashboard-filter";
import { buildCaseFilesSearchConfig } from "@/app/ui/search/case-files-search";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";
import { MemoryDeadlineCell } from "@/app/ui/memory-deadline-cell";
import { type Prisma } from "@prisma/client";

type CaseFileRow = Prisma.CaseFileGetPayload<{
  include: {
    mainClaimant: true;
    mainDefender: true;
    lastProducer: true;
    lastStatus: true;
    lastHearing: true;
  };
}>;

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

function dashboardColumns(detailQueryString: string): DataTableColumn<CaseFileRow>[] {
  const suffix = detailQueryString ? `?${detailQueryString}` : "";

  return [
    {
      key: "caseFileNumber",
      facetKey: "dossier",
      label: "Dossier",
      sortable: true,
      facet: true,
      render: (caseFile) => (
        <Link href={`/case_files/${encodeURIComponent(caseFile.caseFileNumber)}${suffix}`}>
          {caseFile.caseFileNumber}
        </Link>
      ),
    },
    {
      key: "depositDate",
      label: "Date de réception",
      sortable: true,
      render: (caseFile) => formatDateFr(caseFile.depositDate),
    },
    {
      key: "mainClaimant",
      facetKey: "requerant",
      label: "Requérant",
      sortable: true,
      facet: true,
      render: (caseFile) => getActorDisplayName(caseFile.mainClaimant),
    },
    {
      key: "mainDefender",
      facetKey: "defendeur",
      label: "Défendeur",
      sortable: true,
      facet: true,
      render: (caseFile) => getActorDisplayName(caseFile.mainDefender),
    },
    {
      key: "lastProducer",
      facetKey: "producteur",
      label: "Dernier producteur",
      sortable: true,
      facet: true,
      render: (caseFile) => getActorDisplayName(caseFile.lastProducer),
    },
    {
      key: "status",
      facetKey: "statut",
      label: "Statut",
      facet: true,
      render: (caseFile) => caseFile.lastStatus.label,
    },
    {
      key: HEARING_CONVOCATION_SORT_KEY,
      label: "Date limite de production de mémoire",
      sortable: true,
      defaultOrder: "ascending",
      render: (caseFile) => (
        <MemoryDeadlineCell
          date={caseFile.lastHearing?.convocationDate ?? null}
          status={caseFile.lastStatus.label}
        />
      ),
    },
  ];
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

  const [{ rows, totalPages, totalCount }, statusOptions] = await Promise.all([
    fetchCaseFilesTableData(
      tableState.page,
      pageSize,
      tableState.sortBy,
      tableState.sortOrder,
      tableState.query,
      currentStatut,
    ),
    fetchUsedStatusLabels(),
  ]);

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
          statusOptions,
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
