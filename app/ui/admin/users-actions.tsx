"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { deleteUserFormAction, updateUserFormAction } from "@/app/(protected)/admin/users/actions";
import { type JurisdictionListRow } from "@/app/lib/data/jurisdictions";
import { type UserListRow } from "@/app/lib/data/users";
import { UserFormFields } from "@/app/ui/admin/user-form-fields";

const editUserModal = createModal({
  isOpenedByDefault: false,
  id: "admin-edit-user-modal",
});

const deleteUserModal = createModal({
  isOpenedByDefault: false,
  id: "admin-delete-user-modal",
});

type UsersActionsContextValue = {
  openEdit: (user: UserListRow) => void;
  openDelete: (user: UserListRow) => void;
};

const UsersActionsContext = createContext<UsersActionsContextValue | null>(null);

function useUsersActions(): UsersActionsContextValue {
  const context = useContext(UsersActionsContext);
  if (!context) {
    throw new Error("UserRowActions must be used within UsersActionsProvider");
  }
  return context;
}

function EditUserForm({
  user,
  jurisdictions,
}: {
  user: UserListRow;
  jurisdictions: JurisdictionListRow[];
}) {
  const [result, formAction, isPending] = useActionState(updateUserFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      editUserModal.close();
    }
  }, [result]);

  return (
    <form action={formAction} className={fr.cx("fr-mb-2w")}>
      <input type="hidden" name="id" value={user.id} />
      <UserFormFields
        values={{
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isValidated: user.isValidated,
          isAdmin: user.isAdmin,
          jurisdictionIds: user.jurisdictions.map((jurisdiction) => jurisdiction.id),
        }}
        jurisdictions={jurisdictions}
      />

      <Button
        type="submit"
        disabled={isPending}
        iconId="fr-icon-save-line"
        className={fr.cx("fr-mt-2w")}
      >
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>

      {result && !result.ok && (
        <div className={fr.cx("fr-mt-2w")}>
          <Alert severity="error" small description={result.error} />
        </div>
      )}
    </form>
  );
}

function EditUserModal({
  user,
  jurisdictions,
  formOpenGeneration,
}: {
  user: UserListRow | null;
  jurisdictions: JurisdictionListRow[];
  formOpenGeneration: number;
}) {
  return (
    <editUserModal.Component title="Modifier l'utilisateur" iconId="fr-icon-edit-line">
      {user ? (
        <EditUserForm
          key={`${formOpenGeneration}-${user.id}`}
          user={user}
          jurisdictions={jurisdictions}
        />
      ) : (
        <p className={fr.cx("fr-text--sm")}>Aucun utilisateur sélectionné.</p>
      )}
    </editUserModal.Component>
  );
}

function DeleteUserForm({ user }: { user: UserListRow }) {
  const [result, formAction, isPending] = useActionState(deleteUserFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      deleteUserModal.close();
    }
  }, [result]);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;

  return (
    <>
      <p>
        Confirmez-vous la suppression de <strong>{displayName}</strong> ({user.email})&nbsp;? Cette
        action est irréversible.
      </p>
      <form id="admin-delete-user-form" action={formAction}>
        <input type="hidden" name="id" value={user.id} />
      </form>
      <div className={clsx("flex", "flex-row", "gap-2", fr.cx("fr-mt-2w"))}>
        <Button
          type="button"
          priority="secondary"
          disabled={isPending}
          onClick={() => deleteUserModal.close()}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          iconId="fr-icon-delete-bin-line"
          nativeButtonProps={{ form: "admin-delete-user-form" }}
        >
          {isPending ? "Suppression…" : "Supprimer"}
        </Button>
      </div>
      {result && !result.ok && (
        <div className={fr.cx("fr-mt-2w")}>
          <Alert severity="error" small description={result.error} />
        </div>
      )}
    </>
  );
}

function DeleteUserModal({
  user,
  formOpenGeneration,
}: {
  user: UserListRow | null;
  formOpenGeneration: number;
}) {
  return (
    <deleteUserModal.Component title="Supprimer l'utilisateur" iconId="fr-icon-delete-line">
      {user ? (
        <DeleteUserForm key={`${formOpenGeneration}-${user.id}`} user={user} />
      ) : (
        <p className={fr.cx("fr-text--sm")}>Aucun utilisateur sélectionné.</p>
      )}
    </deleteUserModal.Component>
  );
}

export function UsersActionsProvider({
  children,
  jurisdictions,
}: {
  children: ReactNode;
  // Jurisdictions available for the user permission scope selector.
  jurisdictions: JurisdictionListRow[];
}) {
  const [editUser, setEditUser] = useState<UserListRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserListRow | null>(null);
  const [editOpenGeneration, setEditOpenGeneration] = useState(0);
  const [deleteOpenGeneration, setDeleteOpenGeneration] = useState(0);

  useIsModalOpen(editUserModal, {
    onDisclose: () => {
      setEditOpenGeneration((generation) => generation + 1);
    },
  });

  useIsModalOpen(deleteUserModal, {
    onDisclose: () => {
      setDeleteOpenGeneration((generation) => generation + 1);
    },
  });

  const openEdit = useCallback((user: UserListRow) => {
    setEditUser(user);
    editUserModal.open();
  }, []);

  const openDelete = useCallback((user: UserListRow) => {
    setDeleteUser(user);
    deleteUserModal.open();
  }, []);

  const value = useMemo(() => ({ openEdit, openDelete }), [openEdit, openDelete]);

  return (
    <UsersActionsContext.Provider value={value}>
      {children}
      <EditUserModal
        user={editUser}
        jurisdictions={jurisdictions}
        formOpenGeneration={editOpenGeneration}
      />
      <DeleteUserModal user={deleteUser} formOpenGeneration={deleteOpenGeneration} />
    </UsersActionsContext.Provider>
  );
}

export function UserRowActions({ user }: { user: UserListRow }) {
  const { openEdit, openDelete } = useUsersActions();

  return (
    <div className={clsx("flex", "flex-row", "gap-1", "items-center")}>
      <Button
        type="button"
        priority="tertiary no outline"
        size="small"
        iconId="fr-icon-edit-line"
        title={`Modifier ${user.email}`}
        onClick={() => openEdit(user)}
        nativeButtonProps={{ "aria-label": `Modifier ${user.email}` }}
      />
      <Button
        type="button"
        priority="tertiary no outline"
        size="small"
        iconId="fr-icon-delete-bin-line"
        title={`Supprimer ${user.email}`}
        onClick={() => openDelete(user)}
        nativeButtonProps={{ "aria-label": `Supprimer ${user.email}` }}
      />
    </div>
  );
}
