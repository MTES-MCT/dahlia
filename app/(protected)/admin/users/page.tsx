import { fr } from "@codegouvfr/react-dsfr";
import type { Metadata } from "next";
import { fetchUsersTableData, type UserListRow } from "@/app/lib/data/users";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { USERS_FACET_KEYS, USERS_PARAMS } from "@/app/lib/users-table";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";

export const metadata: Metadata = {
  title: "Utilisateurs - Administration",
};

function formatBooleanFr(value: boolean): string {
  return value ? "Oui" : "Non";
}

const USERS_COLUMNS: DataTableColumn<UserListRow>[] = [
  {
    key: "lastName",
    label: "Nom",
    sortable: true,
    defaultOrder: "ascending",
    facetFields: [{ key: "nom", label: "Nom" }],
    render: (user) => user.lastName ?? "—",
  },
  {
    key: "firstName",
    label: "Prénom",
    sortable: true,
    facetFields: [{ key: "prenom", label: "Prénom" }],
    render: (user) => user.firstName ?? "—",
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    facetFields: [{ key: "email", label: "Email" }],
    render: (user) => user.email,
  },
  {
    key: "isValidated",
    label: "Validé",
    render: (user) => formatBooleanFr(user.isValidated),
  },
  {
    key: "isAdmin",
    label: "Admin",
    render: (user) => formatBooleanFr(user.isAdmin),
  },
];

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const table = await fetchUsersTableData(resolvedSearchParams);
  const search = buildTableSearchContext(resolvedSearchParams, USERS_PARAMS, "/admin/users");

  return (
    <>
      <h1 className={fr.cx("fr-mt-3w", "fr-h2")}>Administration des utilisateurs</h1>

      <DataTable
        columns={USERS_COLUMNS}
        rows={table.rows}
        totalCount={table.totalCount}
        totalPages={table.totalPages}
        currentPage={table.currentPage}
        pageSize={table.pageSize}
        params={USERS_PARAMS}
        tableId="users"
        facetKeys={USERS_FACET_KEYS}
        caption={(count) => `${count} utilisateur${count > 1 ? "s" : ""}`}
        search={{
          ...search,
          label: "Rechercher un utilisateur",
          placeholder: "Nom, prénom ou email",
        }}
      />
    </>
  );
}
