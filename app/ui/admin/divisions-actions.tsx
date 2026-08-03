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
import { updateDivisionFormAction } from "@/app/(protected)/admin/divisions/actions";
import { type DivisionListRow } from "@/app/lib/data/divisions";

const editDivisionModal = createModal({
  isOpenedByDefault: false,
  id: "admin-edit-division-modal",
});

type DivisionsActionsContextValue = {
  openEdit: (division: DivisionListRow) => void;
};

const DivisionsActionsContext = createContext<DivisionsActionsContextValue | null>(null);

function useDivisionsActions(): DivisionsActionsContextValue {
  const context = useContext(DivisionsActionsContext);
  if (!context) {
    throw new Error("DivisionRowActions must be used within DivisionsActionsProvider");
  }
  return context;
}

function EditDivisionForm({ division }: { division: DivisionListRow }) {
  const [result, formAction, isPending] = useActionState(updateDivisionFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      editDivisionModal.close();
    }
  }, [result]);

  return (
    <form action={formAction} className={fr.cx("fr-mb-2w")}>
      <input type="hidden" name="id" value={division.id} />

      <Input
        label="Code"
        hintText="Code Télérecours (non modifiable)"
        nativeInputProps={{
          name: "shortName",
          readOnly: true,
          defaultValue: division.shortName,
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
          defaultValue: division.name,
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

function EditDivisionModal({
  division,
  formOpenGeneration,
}: {
  division: DivisionListRow | null;
  formOpenGeneration: number;
}) {
  return (
    <editDivisionModal.Component title="Modifier la division" iconId="fr-icon-edit-line">
      {division ? (
        <EditDivisionForm key={`${formOpenGeneration}-${division.id}`} division={division} />
      ) : (
        <p className={fr.cx("fr-text--sm")}>Aucune division sélectionnée.</p>
      )}
    </editDivisionModal.Component>
  );
}

export function DivisionsActionsProvider({ children }: { children: ReactNode }) {
  const [editDivision, setEditDivision] = useState<DivisionListRow | null>(null);
  const [editOpenGeneration, setEditOpenGeneration] = useState(0);

  useIsModalOpen(editDivisionModal, {
    onDisclose: () => {
      setEditOpenGeneration((generation) => generation + 1);
    },
  });

  const openEdit = useCallback((division: DivisionListRow) => {
    setEditDivision(division);
    editDivisionModal.open();
  }, []);

  const value = useMemo(() => ({ openEdit }), [openEdit]);

  return (
    <DivisionsActionsContext.Provider value={value}>
      {children}
      <EditDivisionModal division={editDivision} formOpenGeneration={editOpenGeneration} />
    </DivisionsActionsContext.Provider>
  );
}

export function DivisionRowActions({ division }: { division: DivisionListRow }) {
  const { openEdit } = useDivisionsActions();

  return (
    <Button
      type="button"
      priority="tertiary no outline"
      size="small"
      iconId="fr-icon-edit-line"
      title={`Modifier ${division.shortName}`}
      onClick={() => openEdit(division)}
      nativeButtonProps={{ "aria-label": `Modifier ${division.shortName}` }}
    />
  );
}
