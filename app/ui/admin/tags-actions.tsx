"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import clsx from "clsx";
import {
  deleteTagFormAction,
  listTagCaseFilesAction,
  updateTagFormAction,
} from "@/app/(protected)/admin/tags/actions";
import { type TagCaseFileRow, type TagListRow } from "@/app/lib/data/tags";
import { TagFormFields } from "@/app/ui/admin/tag-form-fields";

const editTagModal = createModal({
  isOpenedByDefault: false,
  id: "admin-edit-tag-modal",
});

const deleteTagModal = createModal({
  isOpenedByDefault: false,
  id: "admin-delete-tag-modal",
});

const tagInUseModal = createModal({
  isOpenedByDefault: false,
  id: "admin-tag-in-use-modal",
});

type TagsActionsContextValue = {
  openEdit: (tag: TagListRow) => void;
  openDelete: (tag: TagListRow) => void;
};

const TagsActionsContext = createContext<TagsActionsContextValue | null>(null);

function useTagsActions(): TagsActionsContextValue {
  const context = useContext(TagsActionsContext);
  if (!context) {
    throw new Error("TagRowActions must be used within TagsActionsProvider");
  }
  return context;
}

function EditTagForm({ tag }: { tag: TagListRow }) {
  const [result, formAction, isPending] = useActionState(updateTagFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      editTagModal.close();
    }
  }, [result]);

  return (
    <form action={formAction} className={fr.cx("fr-mb-2w")}>
      <input type="hidden" name="id" value={tag.id} />

      <TagFormFields values={{ label: tag.label, color: tag.color }} />

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

const DELETE_TAG_FORM_ID = "admin-delete-tag-form";

function DeleteTagForm({ tag }: { tag: TagListRow }) {
  const [result, formAction, isPending] = useActionState(deleteTagFormAction, null);

  useEffect(() => {
    if (result?.ok) {
      deleteTagModal.close();
    }
  }, [result]);

  return (
    <>
      <p>
        Confirmez-vous la suppression du tag <strong>{tag.label}</strong>&nbsp;? Cette action est
        irréversible.
      </p>

      {/* The buttons live outside the form and target it via the `form`
          attribute, so the DSFR footer layout is preserved. */}
      <form id={DELETE_TAG_FORM_ID} action={formAction}>
        <input type="hidden" name="id" value={tag.id} />
      </form>

      <div className={clsx("flex", "flex-row", "gap-2", fr.cx("fr-mt-2w"))}>
        <Button
          type="button"
          priority="secondary"
          disabled={isPending}
          onClick={() => deleteTagModal.close()}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          iconId="fr-icon-delete-bin-line"
          nativeButtonProps={{ form: DELETE_TAG_FORM_ID }}
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

type TagUsage =
  | { status: "loading" }
  | { status: "loaded"; caseFiles: TagCaseFileRow[] }
  | { status: "error"; error: string };

// Shown instead of the confirmation when the tag is still attached to case
// files: deletion is refused, and the blocking case files are listed so the
// administrator can go and detach the tag.
function TagInUseContent({ tag, usage }: { tag: TagListRow; usage: TagUsage | null }) {
  const count = tag.caseFileCount;

  return (
    <>
      <p>
        Le tag <strong>{tag.label}</strong> ne peut pas être supprimé&nbsp;: il est utilisé par{" "}
        <strong>
          {count} dossier{count > 1 ? "s" : ""}
        </strong>
        . Retirez-le de ces dossiers avant de le supprimer.
      </p>

      {usage?.status === "loading" && <p className={fr.cx("fr-text--sm")}>Chargement…</p>}

      {usage?.status === "error" && <Alert severity="error" small description={usage.error} />}

      {usage?.status === "loaded" && (
        <ul>
          {usage.caseFiles.map((caseFile) => (
            <li key={caseFile.caseFileNumber}>
              <a
                href={`/case_files/${encodeURIComponent(caseFile.caseFileNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {caseFile.displayName}
                <span className={fr.cx("fr-sr-only")}> (nouvelle fenêtre)</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {usage?.status === "loaded" && usage.caseFiles.length < count && (
        <p className={fr.cx("fr-text--sm")}>
          … et {count - usage.caseFiles.length} autre
          {count - usage.caseFiles.length > 1 ? "s" : ""} hors de cette liste.
        </p>
      )}

      <div className={clsx("flex", "flex-row", "gap-2", fr.cx("fr-mt-2w"))}>
        <Button type="button" priority="secondary" onClick={() => tagInUseModal.close()}>
          Fermer
        </Button>
      </div>
    </>
  );
}

export function TagsActionsProvider({ children }: { children: ReactNode }) {
  const [selectedTag, setSelectedTag] = useState<TagListRow | null>(null);
  const [editOpenGeneration, setEditOpenGeneration] = useState(0);
  const [usage, setUsage] = useState<TagUsage | null>(null);
  const [, startTransition] = useTransition();

  useIsModalOpen(editTagModal, {
    onDisclose: () => {
      setEditOpenGeneration((generation) => generation + 1);
    },
  });

  const openEdit = useCallback((tag: TagListRow) => {
    setSelectedTag(tag);
    editTagModal.open();
  }, []);

  // The per-row count decides which modal opens, so there is never a modal that
  // has to be swapped after a round-trip. Only the blocking case file list is
  // fetched on demand — preloading it for every row would bloat the payload.
  const openDelete = useCallback((tag: TagListRow) => {
    setSelectedTag(tag);

    if (tag.caseFileCount === 0) {
      deleteTagModal.open();
      return;
    }

    setUsage({ status: "loading" });
    tagInUseModal.open();
    startTransition(async () => {
      const result = await listTagCaseFilesAction(tag.id);
      setUsage(
        result.ok
          ? { status: "loaded", caseFiles: result.caseFiles }
          : { status: "error", error: result.error },
      );
    });
  }, []);

  const value = useMemo(() => ({ openEdit, openDelete }), [openEdit, openDelete]);

  return (
    <TagsActionsContext.Provider value={value}>
      {children}

      <editTagModal.Component title="Modifier le tag" iconId="fr-icon-edit-line">
        {selectedTag ? (
          <EditTagForm key={`${editOpenGeneration}-${selectedTag.id}`} tag={selectedTag} />
        ) : (
          <p className={fr.cx("fr-text--sm")}>Aucun tag sélectionné.</p>
        )}
      </editTagModal.Component>

      <deleteTagModal.Component title="Supprimer le tag" iconId="fr-icon-delete-bin-line">
        {selectedTag ? (
          <DeleteTagForm tag={selectedTag} />
        ) : (
          <p className={fr.cx("fr-text--sm")}>Aucun tag sélectionné.</p>
        )}
      </deleteTagModal.Component>

      <tagInUseModal.Component title="Suppression impossible" iconId="fr-icon-warning-line">
        {selectedTag ? (
          <TagInUseContent tag={selectedTag} usage={usage} />
        ) : (
          <p className={fr.cx("fr-text--sm")}>Aucun tag sélectionné.</p>
        )}
      </tagInUseModal.Component>
    </TagsActionsContext.Provider>
  );
}

export function TagRowActions({ tag }: { tag: TagListRow }) {
  const { openEdit, openDelete } = useTagsActions();

  return (
    <div className={clsx("flex", "flex-row")}>
      <Button
        type="button"
        priority="tertiary no outline"
        size="small"
        iconId="fr-icon-edit-line"
        title={`Modifier le tag ${tag.label}`}
        onClick={() => openEdit(tag)}
        nativeButtonProps={{ "aria-label": `Modifier le tag ${tag.label}` }}
      />
      <Button
        type="button"
        priority="tertiary no outline"
        size="small"
        iconId="fr-icon-delete-bin-line"
        title={`Supprimer le tag ${tag.label}`}
        onClick={() => openDelete(tag)}
        nativeButtonProps={{ "aria-label": `Supprimer le tag ${tag.label}` }}
      />
    </div>
  );
}
