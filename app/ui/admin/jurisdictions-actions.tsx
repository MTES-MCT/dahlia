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
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { updateJurisdictionFormAction } from "@/app/(protected)/admin/jurisdiction/actions";
import { type JurisdictionListRow } from "@/app/lib/data/jurisdictions";

const editJurisdictionModal = createModal({
  isOpenedByDefault: false,
  id: "admin-edit-jurisdiction-modal",
});

type JurisdictionsActionsContextValue = {
  openEdit: (jurisdiction: JurisdictionListRow) => void;
};

const JurisdictionsActionsContext = createContext<JurisdictionsActionsContextValue | null>(null);

function useJurisdictionsActions(): JurisdictionsActionsContextValue {
  const context = useContext(JurisdictionsActionsContext);
  if (!context) {
    throw new Error("JurisdictionRowActions must be used within JurisdictionsActionsProvider");
  }
  return context;
}

function EditJurisdictionForm({ jurisdiction }: { jurisdiction: JurisdictionListRow }) {
  const [result, formAction, isPending] = useActionState(updateJurisdictionFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      editJurisdictionModal.close();
    }
  }, [result]);

  return (
    <form action={formAction} className={fr.cx("fr-mb-2w")}>
      <input type="hidden" name="id" value={jurisdiction.id} />

      <Input
        label="Code"
        hintText="Code Télérecours (non modifiable)"
        nativeInputProps={{
          name: "shortName",
          readOnly: true,
          defaultValue: jurisdiction.shortName,
        }}
      />

      <Input
        label="Nom"
        hintText="Obligatoire"
        className={fr.cx("fr-mt-2w")}
        nativeInputProps={{
          name: "name",
          required: true,
          autoComplete: "off",
          defaultValue: jurisdiction.name,
        }}
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

function EditJurisdictionModal({
  jurisdiction,
  formOpenGeneration,
}: {
  jurisdiction: JurisdictionListRow | null;
  formOpenGeneration: number;
}) {
  return (
    <editJurisdictionModal.Component title="Modifier la juridiction" iconId="fr-icon-edit-line">
      {jurisdiction ? (
        <EditJurisdictionForm
          key={`${formOpenGeneration}-${jurisdiction.id}`}
          jurisdiction={jurisdiction}
        />
      ) : (
        <p className={fr.cx("fr-text--sm")}>Aucune juridiction sélectionnée.</p>
      )}
    </editJurisdictionModal.Component>
  );
}

export function JurisdictionsActionsProvider({ children }: { children: ReactNode }) {
  const [editJurisdiction, setEditJurisdiction] = useState<JurisdictionListRow | null>(null);
  const [editOpenGeneration, setEditOpenGeneration] = useState(0);

  useIsModalOpen(editJurisdictionModal, {
    onDisclose: () => {
      setEditOpenGeneration((generation) => generation + 1);
    },
  });

  const openEdit = useCallback((jurisdiction: JurisdictionListRow) => {
    setEditJurisdiction(jurisdiction);
    editJurisdictionModal.open();
  }, []);

  const value = useMemo(() => ({ openEdit }), [openEdit]);

  return (
    <JurisdictionsActionsContext.Provider value={value}>
      {children}
      <EditJurisdictionModal
        jurisdiction={editJurisdiction}
        formOpenGeneration={editOpenGeneration}
      />
    </JurisdictionsActionsContext.Provider>
  );
}

export function JurisdictionRowActions({ jurisdiction }: { jurisdiction: JurisdictionListRow }) {
  const { openEdit } = useJurisdictionsActions();

  return (
    <Button
      type="button"
      priority="tertiary no outline"
      size="small"
      iconId="fr-icon-edit-line"
      title={`Modifier ${jurisdiction.shortName}`}
      onClick={() => openEdit(jurisdiction)}
      nativeButtonProps={{ "aria-label": `Modifier ${jurisdiction.shortName}` }}
    />
  );
}
