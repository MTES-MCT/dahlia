import { fr } from "@codegouvfr/react-dsfr";
import type { Metadata } from "next";
import { fetchDivisionsTableData, type DivisionListRow } from "@/app/lib/data/divisions";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { DIVISIONS_FACET_KEYS, DIVISIONS_PARAMS } from "@/app/lib/divisions-table";
import { DivisionRowActions, DivisionsActionsProvider } from "@/app/ui/admin/divisions-actions";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";

export const metadata: Metadata = {
  title: "Divisions - Administration",
};

function divisionsColumns(): DataTableColumn<DivisionListRow>[] {
  return [
    {
      key: "shortName",
      label: "Code",
      sortable: true,
      defaultOrder: "ascending",
      facetFields: [{ key: "code", label: "Code" }],
      render: (division) => division.shortName,
    },
    {
      key: "name",
      label: "Nom",
      sortable: true,
      facetFields: [{ key: "nom", label: "Nom" }],
      render: (division) => division.name || "—",
    },
    {
      key: "actions",
      label: "Actions",
      width: "6rem",
      render: (division) => <DivisionRowActions division={division} />,
    },
  ];
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDivisionsPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const table = await fetchDivisionsTableData(resolvedSearchParams);
  const search = buildTableSearchContext(resolvedSearchParams, DIVISIONS_PARAMS, "/admin/divisions");

  return (
    <DivisionsActionsProvider>
      <h1 className={fr.cx("fr-h2", "fr-mb-2w")}>Divisions</h1>

      <DataTable
        columns={divisionsColumns()}
        rows={table.rows}
        totalCount={table.totalCount}
        totalPages={table.totalPages}
        currentPage={table.currentPage}
        pageSize={table.pageSize}
        params={DIVISIONS_PARAMS}
        tableId="divisions"
        facetKeys={DIVISIONS_FACET_KEYS}
        caption={(count) => `${count} division${count > 1 ? "s" : ""}`}
        search={{
          ...search,
          label: "Rechercher une division",
          placeholder: "Code ou nom",
        }}
      />
    </DivisionsActionsProvider>
  );
}
