import { fr } from "@codegouvfr/react-dsfr";
import type { Metadata } from "next";
import {
  fetchJurisdictionsTableData,
  type JurisdictionListRow,
} from "@/app/lib/data/jurisdictions";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import {
  JURISDICTIONS_FACET_KEYS,
  JURISDICTIONS_PARAMS,
} from "@/app/lib/jurisdictions-table";
import {
  JurisdictionRowActions,
  JurisdictionsActionsProvider,
} from "@/app/ui/admin/jurisdictions-actions";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";

export const metadata: Metadata = {
  title: "Juridiction - Administration",
};

function jurisdictionsColumns(): DataTableColumn<JurisdictionListRow>[] {
  return [
    {
      key: "shortName",
      label: "Code",
      sortable: true,
      defaultOrder: "ascending",
      facetFields: [{ key: "code", label: "Code" }],
      render: (jurisdiction) => jurisdiction.shortName,
    },
    {
      key: "name",
      label: "Nom",
      sortable: true,
      facetFields: [{ key: "nom", label: "Nom" }],
      render: (jurisdiction) => jurisdiction.name || "—",
    },
    {
      key: "actions",
      label: "Actions",
      width: "6rem",
      render: (jurisdiction) => <JurisdictionRowActions jurisdiction={jurisdiction} />,
    },
  ];
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminJurisdictionPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const table = await fetchJurisdictionsTableData(resolvedSearchParams);
  const search = buildTableSearchContext(
    resolvedSearchParams,
    JURISDICTIONS_PARAMS,
    "/admin/jurisdiction",
  );

  return (
    <JurisdictionsActionsProvider>
      <h1 className={fr.cx("fr-h2", "fr-mb-2w")}>Juridiction</h1>

      <DataTable
        columns={jurisdictionsColumns()}
        rows={table.rows}
        totalCount={table.totalCount}
        totalPages={table.totalPages}
        currentPage={table.currentPage}
        pageSize={table.pageSize}
        params={JURISDICTIONS_PARAMS}
        tableId="jurisdictions"
        facetKeys={JURISDICTIONS_FACET_KEYS}
        caption={(count) => `${count} juridiction${count > 1 ? "s" : ""}`}
        search={{
          ...search,
          label: "Rechercher une juridiction",
          placeholder: "Code ou nom",
        }}
      />
    </JurisdictionsActionsProvider>
  );
}
