"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  deleteSavedSearchFormAction,
  saveSearchFormAction,
} from "@/app/(protected)/case_files/actions";
import { STATUS_GROUP_LABELS, type StatusGroup } from "@/app/lib/dashboard-filter";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import {
  SAVED_SEARCH_NAME_MAX_LENGTH,
  dashboardSearchHref,
  findCurrentSavedSearch,
  type DashboardSortParams,
  type SavedSearchView,
} from "@/app/lib/saved-searches";

// Module-level modals: the « Sauvegarder la recherche » link lives inside the
// search form while the modals (which hold their own forms) are rendered by
// `SavedSearches`, outside of it, since forms cannot be nested.
const saveSearchModal = createModal({ isOpenedByDefault: false, id: "save-search-modal" });
const applySavedSearchModal = createModal({
  isOpenedByDefault: false,
  id: "apply-saved-search-modal",
});
const deleteSavedSearchModal = createModal({
  isOpenedByDefault: false,
  id: "delete-saved-search-modal",
});

// Main « Rechercher » field (see CaseFilesSearchFields), which always exists.
const MAIN_SEARCH_FIELD_ID = `${DASHBOARD_TABLE_PARAMS.query}-search`;
const APPLY_FORM_ID = "apply-saved-search-form";
const SAVE_FORM_ID = "save-search-form";
const DELETE_FORM_ID = "delete-saved-search-form";

type SavedSearchUiContextValue = {
  saveButton: ReactNode;
  labelSlot: ReactNode;
};

const SavedSearchUiContext = createContext<SavedSearchUiContextValue>({
  saveButton: null,
  labelSlot: null,
});

export function SaveCurrentSearchButton() {
  return useContext(SavedSearchUiContext).saveButton;
}

// « Recherche : » row (saved search name + switch control) in place of the
// visible « Rechercher » label on the dashboard search field.
export function SavedSearchLabelRow({ className }: { className?: string }) {
  const labelSlot = useContext(SavedSearchUiContext).labelSlot;
  if (!labelSlot) return null;
  return <div className={clsx("relative min-w-0", className)}>{labelSlot}</div>;
}

const APPLY_SAVED_SEARCH_LABEL = "Appliquer une recherche";
const CHANGE_SAVED_SEARCH_LABEL = "Changer de recherche";
const CLEAR_SEARCH_LABEL = "Effacer les critères de recherche";

// Icon-only below lg; icon + label from the DSFR lg breakpoint (62em).
function SavedSearchRowButton({
  label,
  iconId,
  priority,
  onClick,
  ariaControls,
}: {
  label: string;
  iconId: NonNullable<ComponentProps<typeof Button>["iconId"]>;
  priority: "secondary" | "tertiary";
  onClick: () => void;
  ariaControls?: string;
}) {
  return (
    <Button
      type="button"
      priority={priority}
      size="small"
      iconId={iconId}
      iconPosition="left"
      title={label}
      onClick={onClick}
      nativeButtonProps={
        ariaControls ? { "aria-controls": ariaControls } : undefined
      }
    >
      <span className={clsx("hidden", "lg:inline")}>{label}</span>
    </Button>
  );
}

type SaveFormProps = { query: string; statusGroup: StatusGroup };

function SaveSearchForm({ query, statusGroup }: SaveFormProps) {
  const [result, formAction, isPending] = useActionState(saveSearchFormAction, null);

  useEffect(() => {
    if (result?.ok) saveSearchModal.close();
  }, [result]);

  const error = result && !result.ok ? result.error : undefined;

  return (
    <>
      <p>Vous pourrez ré-utiliser cette recherche pour de futures connexions à DAHLIA.</p>
      <form id={SAVE_FORM_ID} action={formAction} noValidate>
        <input type="hidden" name="query" value={query} />
        <input type="hidden" name="statusGroup" value={statusGroup} />
        <Input
          label="Nom de la recherche"
          className={clsx(fr.cx("fr-mb-1w"), "max-w-md")}
          state={error ? "error" : "default"}
          stateRelatedMessage={error}
          nativeInputProps={{
            name: "name",
            maxLength: SAVED_SEARCH_NAME_MAX_LENGTH,
            autoComplete: "off",
            required: true,
          }}
        />
        <p className={clsx(fr.cx("fr-text--sm", "fr-mb-0"), "text-(--text-mention-grey)")}>
          Critères : {query} ({STATUS_GROUP_LABELS[statusGroup]})
        </p>
      </form>
      <div className={clsx("flex", "flex-row", "gap-2", fr.cx("fr-mt-3w"))}>
        <Button
          type="button"
          priority="secondary"
          disabled={isPending}
          onClick={() => saveSearchModal.close()}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isPending} nativeButtonProps={{ form: SAVE_FORM_ID }}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </>
  );
}

function DeleteSavedSearchForm({ search }: { search: SavedSearchView }) {
  const [result, formAction, isPending] = useActionState(deleteSavedSearchFormAction, null);

  useEffect(() => {
    if (!result?.ok) return;
    deleteSavedSearchModal.close();
    // The applied-search controls go away with the search: move the focus to
    // the main search field.
    document.getElementById(MAIN_SEARCH_FIELD_ID)?.focus();
  }, [result]);

  return (
    <>
      <p>
        Confirmez-vous la suppression de la recherche <strong>{search.name}</strong>&nbsp;? Cette
        action est irréversible.
      </p>
      <form id={DELETE_FORM_ID} action={formAction}>
        <input type="hidden" name="id" value={search.id} />
      </form>
      <div className={clsx("flex", "flex-row", "gap-2", fr.cx("fr-mt-2w"))}>
        <Button
          type="button"
          priority="secondary"
          disabled={isPending}
          onClick={() => deleteSavedSearchModal.close()}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          iconId="fr-icon-delete-line"
          nativeButtonProps={{ form: DELETE_FORM_ID }}
        >
          {isPending ? "Suppression…" : "Supprimer"}
        </Button>
      </div>
      {result && !result.ok && (
        <p className={fr.cx("fr-error-text")} role="alert">
          {result.error}
        </p>
      )}
    </>
  );
}

type ApplyFormProps = {
  searches: readonly SavedSearchView[];
  current: SavedSearchView | undefined;
  onApply: (search: SavedSearchView) => void;
  onDelete: (search: SavedSearchView) => void;
};

// Choice of a saved search (radio list, applied with the « Appliquer » button
// rather than on change) and, when a saved search is applied, a danger zone to
// delete the search checked in the list (the applied one until another is
// checked).
function ApplySavedSearchForm({ searches, current, onApply, onDelete }: ApplyFormProps) {
  const [selectedId, setSelectedId] = useState<number | null>(current?.id ?? null);
  const [showError, setShowError] = useState(false);
  const selected = searches.find((candidate) => candidate.id === selectedId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setShowError(true);
      return;
    }
    onApply(selected);
  }

  return (
    <>
      <form id={APPLY_FORM_ID} onSubmit={handleSubmit} noValidate>
        <RadioButtons
          legend="Recherches sauvegardées"
          name="savedSearch"
          state={showError ? "error" : "default"}
          stateRelatedMessage={showError ? "Choisissez une recherche." : undefined}
          options={searches.map((search) => ({
            label: search.name,
            hintText: `${search.query} (${STATUS_GROUP_LABELS[search.statusGroup]})`,
            nativeInputProps: {
              value: String(search.id),
              checked: selectedId === search.id,
              onChange: () => {
                setSelectedId(search.id);
                setShowError(false);
              },
            },
          }))}
        />
      </form>
      <div className={clsx("flex", "flex-row", "gap-2")}>
        <Button type="button" priority="secondary" onClick={() => applySavedSearchModal.close()}>
          Annuler
        </Button>
        <Button type="submit" nativeButtonProps={{ form: APPLY_FORM_ID }}>
          Appliquer
        </Button>
      </div>

      {current && selected && (
        <section
          aria-labelledby="saved-search-danger-zone"
          className={clsx(
            "border border-solid border-(--border-default-red-marianne)",
            fr.cx("fr-mt-4w", "fr-p-2w"),
          )}
        >
          <h2 id="saved-search-danger-zone" className={fr.cx("fr-h6", "fr-mb-1w")}>
            Zone de danger
          </h2>
          <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
            Supprimer la recherche{selected.id === current.id ? " appliquée" : ""}{" "}
            <strong>{selected.name}</strong>. Une confirmation vous sera demandée.
          </p>
          <Button
            type="button"
            priority="secondary"
            size="small"
            iconId="fr-icon-delete-line"
            iconPosition="left"
            onClick={() => onDelete(selected)}
            nativeButtonProps={{ "aria-controls": deleteSavedSearchModal.id }}
          >
            Supprimer cette recherche
          </Button>
        </section>
      )}
    </>
  );
}

type Props = {
  searches: readonly SavedSearchView[];
  // Search currently displayed (raw `dahliaq`) and its tab.
  currentQuery: string;
  currentGroup: StatusGroup;
  sort?: DashboardSortParams;
  children?: ReactNode;
};

// Saved searches for the dashboard. The applied-search controls (or « Appliquer
// une recherche sauvegardée ») sit on the main search label row via
// `SavedSearchLabelRow`. « Sauvegarder la recherche courante » is next to
// « Rechercher » via `SaveCurrentSearchButton`. Modals are rendered here so
// they stay outside the GET search form.
export function SavedSearches({ searches, currentQuery, currentGroup, sort, children }: Props) {
  const router = useRouter();
  const current = findCurrentSavedSearch(searches, currentQuery, currentGroup);
  // Only a displayed search that is not already a saved one can be saved.
  const canSave = currentQuery.trim() !== "";
  // Remount the forms on every opening so they start from the current state.
  const [saveGeneration, setSaveGeneration] = useState(0);
  const [applyGeneration, setApplyGeneration] = useState(0);
  // Kept while the delete modal closes, so its content does not vanish.
  const [toDelete, setToDelete] = useState<SavedSearchView | null>(null);

  useIsModalOpen(saveSearchModal, {
    onDisclose: () => setSaveGeneration((generation) => generation + 1),
  });
  useIsModalOpen(applySavedSearchModal, {
    onDisclose: () => setApplyGeneration((generation) => generation + 1),
  });

  function applySearch(search: SavedSearchView) {
    applySavedSearchModal.close();
    if (search.id === current?.id) return;
    router.push(dashboardSearchHref(search.query, search.statusGroup, sort), { scroll: false });
  }

  // Reset every search criterion (free text and facets), staying in the tab.
  function clearSearch() {
    router.push(dashboardSearchHref("", currentGroup, sort), { scroll: false });
    document.getElementById(MAIN_SEARCH_FIELD_ID)?.focus();
  }

  function openDelete(search: SavedSearchView) {
    setToDelete(search);
    applySavedSearchModal.close();
    deleteSavedSearchModal.open();
  }

  const saveCurrentSearchButton =
    !current && canSave ? (
      <Button
        type="button"
        priority="tertiary"
        iconId="fr-icon-save-line"
        iconPosition="left"
        onClick={() => saveSearchModal.open()}
        nativeButtonProps={{ "aria-controls": saveSearchModal.id }}
      >
        Sauvegarder la recherche courante
      </Button>
    ) : null;

  const showSavedSearchControls = current || searches.length > 0;

  const labelSlot = (
    <div className={clsx("flex flex-wrap items-center gap-2")}>
      <p className={fr.cx("fr-mb-0")}>
        Recherche&nbsp;: {current ? <strong>{current.name}</strong> : null}
      </p>
      {showSavedSearchControls ? (
        <SavedSearchRowButton
          label={current ? CHANGE_SAVED_SEARCH_LABEL : APPLY_SAVED_SEARCH_LABEL}
          iconId="fr-icon-arrow-left-right-line"
          priority="secondary"
          onClick={() => applySavedSearchModal.open()}
          ariaControls={applySavedSearchModal.id}
        />
      ) : null}
      {canSave ? (
        <SavedSearchRowButton
          label={CLEAR_SEARCH_LABEL}
          iconId="fr-icon-close-line"
          priority="tertiary"
          onClick={clearSearch}
        />
      ) : null}
    </div>
  );

  return (
    <SavedSearchUiContext.Provider value={{ saveButton: saveCurrentSearchButton, labelSlot }}>
      {children}

      <applySavedSearchModal.Component title="Appliquer une recherche sauvegardée">
        <ApplySavedSearchForm
          key={applyGeneration}
          searches={searches}
          current={current}
          onApply={applySearch}
          onDelete={openDelete}
        />
      </applySavedSearchModal.Component>

      <saveSearchModal.Component title="Sauvegarder la recherche">
        <SaveSearchForm
          key={saveGeneration}
          query={currentQuery.trim()}
          statusGroup={currentGroup}
        />
      </saveSearchModal.Component>

      <deleteSavedSearchModal.Component title="Supprimer la recherche">
        {toDelete && <DeleteSavedSearchForm key={toDelete.id} search={toDelete} />}
      </deleteSavedSearchModal.Component>
    </SavedSearchUiContext.Provider>
  );
}
