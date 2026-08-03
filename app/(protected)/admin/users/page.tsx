import { fr } from "@codegouvfr/react-dsfr";
import type { Metadata } from "next";
import clsx from "clsx";
import { fetchUsersTableData, type UserListRow } from "@/app/lib/data/users";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { USERS_FACET_KEYS, USERS_PARAMS } from "@/app/lib/users-table";
import { CreateUserButton } from "@/app/ui/admin/create-user-button";
import { UserRowActions, UsersActionsProvider } from "@/app/ui/admin/users-actions";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";

export const metadata: Metadata = {
  title: "Utilisateurs - Administration",
};

function formatBooleanFr(value: boolean): string {
  return value ? "Oui" : "Non";
}

function usersColumns(): DataTableColumn<UserListRow>[] {
  return [
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
    {
      key: "actions",
      label: "Actions",
      width: "6rem",
      render: (user) => <UserRowActions user={user} />,
    },
  ];
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const table = await fetchUsersTableData(resolvedSearchParams);
  const search = buildTableSearchContext(resolvedSearchParams, USERS_PARAMS, "/admin/users");

  return (
    <UsersActionsProvider>
      <div
        className={clsx(
          fr.cx("fr-mb-2w"),
          "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <h1 className={fr.cx("fr-h2", "fr-mb-0")}>Utilisateurs</h1>
        <CreateUserButton />
      </div>

      <DataTable
        columns={usersColumns()}
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
    </UsersActionsProvider>
  );
}
