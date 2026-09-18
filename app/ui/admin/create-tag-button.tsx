"use client";

import { useActionState, useEffect, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { createTagFormAction } from "@/app/(protected)/admin/tags/actions";
import { EMPTY_TAG_FORM_VALUES, TagFormFields } from "@/app/ui/admin/tag-form-fields";

const createTagModal = createModal({
  isOpenedByDefault: false,
  id: "admin-create-tag-modal",
});

function CreateTagForm() {
  const [result, formAction, isPending] = useActionState(createTagFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      createTagModal.close();
    }
  }, [result]);

  return (
    <form action={formAction} className={fr.cx("fr-mb-2w")}>
      <TagFormFields values={EMPTY_TAG_FORM_VALUES} />

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

export function CreateTagButton() {
  const [formOpenGeneration, setFormOpenGeneration] = useState(0);

  useIsModalOpen(createTagModal, {
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
          ...createTagModal.buttonProps,
          type: "button",
        }}
      >
        Créer un tag
      </Button>

      <createTagModal.Component title="Créer un tag" iconId="ri-price-tag-3-line">
        <CreateTagForm key={formOpenGeneration} />
      </createTagModal.Component>
    </>
  );
}
