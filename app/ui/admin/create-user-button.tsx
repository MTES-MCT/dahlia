"use client";

import { useActionState, useEffect, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { createUserFormAction } from "@/app/(protected)/admin/users/actions";
import type { JurisdictionListRow } from "@/app/lib/data/jurisdictions";
import { EMPTY_USER_FORM_VALUES, UserFormFields } from "@/app/ui/admin/user-form-fields";

const createUserModal = createModal({
  isOpenedByDefault: false,
  id: "admin-create-user-modal",
});

function CreateUserForm({ jurisdictions }: { jurisdictions: JurisdictionListRow[] }) {
  const [result, formAction, isPending] = useActionState(createUserFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      createUserModal.close();
    }
  }, [result]);

  return (
    <form action={formAction} className={fr.cx("fr-mb-2w")}>
      <UserFormFields values={EMPTY_USER_FORM_VALUES} jurisdictions={jurisdictions} />

      <Button
        type="submit"
        disabled={isPending}
        iconId="fr-icon-save-line"
        className={fr.cx("fr-mt-2w")}
      >
        {isPending ? "Création…" : "Créer"}
      </Button>

      {result && !result.ok && (
        <div className={fr.cx("fr-mt-2w")}>
          <Alert severity="error" small description={result.error} />
        </div>
      )}
    </form>
  );
}

export function CreateUserButton({ jurisdictions }: { jurisdictions: JurisdictionListRow[] }) {
  const [formOpenGeneration, setFormOpenGeneration] = useState(0);

  useIsModalOpen(createUserModal, {
    onDisclose: () => {
      setFormOpenGeneration((generation) => generation + 1);
    },
  });

  return (
    <>
      <Button
        priority="primary"
        iconId="fr-icon-add-line"
        nativeButtonProps={{
          ...createUserModal.buttonProps,
          type: "button",
        }}
      >
        Créer un utilisateur
      </Button>

      <createUserModal.Component title="Créer un utilisateur" iconId="fr-icon-user-add-line">
        <CreateUserForm key={formOpenGeneration} jurisdictions={jurisdictions} />
      </createUserModal.Component>
    </>
  );
}
