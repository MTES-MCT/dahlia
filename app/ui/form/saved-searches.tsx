"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { Select } from "@codegouvfr/react-dsfr/Select";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  deleteSavedSearchFormAction,
  saveSearchFormAction,
} from "@/app/(protected)/case_files/actions";
import { STATUS_GROUP_LABELS, type StatusGroup } from "@/app/lib/dashboard-filter";
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
const deleteSavedSearchModal = createModal({
  isOpenedByDefault: false,
  id: "delete-saved-search-modal",
});

const SELECT_ID = "saved-search-select";
// Value of the empty option; distinct from the placeholder's "" so the two never
// match the same select value.
const NO_SEARCH_VALUE = "none";
const SAVE_FORM_ID = "save-search-form";
const DELETE_FORM_ID = "delete-saved-search-form";

// « Sauvegarder la recherche » link of the search form's submit bar. A button
// (not a link): it opens a dialog and must not submit the search form.
export function SaveSearchLink() {
  return (
    <button
      type="button"
      className={fr.cx("fr-link", "fr-icon-save-line", "fr-link--icon-left")}
      aria-controls={saveSearchModal.id}
      onClick={() => saveSearchModal.open()}
    >
      Sauvegarder la recherche
    </button>
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
    // The « Supprimer cette recherche » button that opened the modal goes away
    // with the search: give the focus back to the select.
    document.getElementById(SELECT_ID)?.focus();
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

type Props = {
  searches: readonly SavedSearchView[];
  // Search currently displayed (raw `dahliaq`) and its tab.
  currentQuery: string;
  currentGroup: StatusGroup;
  sort?: DashboardSortParams;
};

// « Mes recherches »: select of the user's saved searches, shown above the
// search frame. Picking one runs it right away; the search currently displayed
// is preselected and can be deleted (after confirmation in a modal). Also
// renders the « Sauvegarder la recherche » modal opened by `SaveSearchLink`.
export function SavedSearches({ searches, currentQuery, currentGroup, sort }: Props) {
  const router = useRouter();
  const current = findCurrentSavedSearch(searches, currentQuery, currentGroup);
  // Remount the save form on every opening so the name and errors start blank.
  const [saveGeneration, setSaveGeneration] = useState(0);
  // Kept while the delete modal closes, so its content does not vanish.
  const [toDelete, setToDelete] = useState<SavedSearchView | null>(null);

  useIsModalOpen(saveSearchModal, {
    onDisclose: () => setSaveGeneration((generation) => generation + 1),
  });

  function handleChange(id: string) {
    const search = searches.find((candidate) => String(candidate.id) === id);
    router.push(
      search
        ? dashboardSearchHref(search.query, search.statusGroup, sort)
        : dashboardSearchHref("", currentGroup, sort),
      { scroll: false },
    );
  }

  function openDelete(search: SavedSearchView) {
    setToDelete(search);
    deleteSavedSearchModal.open();
  }

  return (
    <>
      {searches.length > 0 && (
        <div className={clsx("flex flex-wrap items-end gap-x-4 gap-y-2", fr.cx("fr-mb-3w"))}>
          <Select
            label="Mes recherches"
            className={clsx(fr.cx("fr-mb-0"), "max-w-96 min-w-0 flex-[0_1_24rem]")}
            nativeSelectProps={{
              id: SELECT_ID,
              value: current ? String(current.id) : "",
              onChange: (event) => handleChange(event.target.value),
            }}
          >
            {/* Native selects have no placeholder: this option is shown while no
                saved search is displayed, but cannot be picked from the list. */}
            <option value="" disabled hidden>
              Choisir une recherche sauvegardée
            </option>
            {/* Empty choice: clears the search. */}
            <option value={NO_SEARCH_VALUE} />
            {searches.map((search) => (
              <option key={search.id} value={search.id}>
                {search.name}
              </option>
            ))}
          </Select>
          {current && (
            <Button
              type="button"
              priority="tertiary no outline"
              size="small"
              iconId="fr-icon-delete-line"
              iconPosition="left"
              onClick={() => openDelete(current)}
              nativeButtonProps={{ "aria-controls": deleteSavedSearchModal.id }}
            >
              Supprimer cette recherche
            </Button>
          )}
        </div>
      )}

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
    </>
  );
}
