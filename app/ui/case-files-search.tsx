import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import clsx from "clsx";
import Link from "next/link";
import { CaseFilesSearchByStatus } from "@/app/ui/case-files-search-by-status";
import { CaseFilesSearchBar } from "@/app/ui/case-files-search-bar";
import { HiddenField } from "@/app/ui/hidden-field";

type Props = {
  // Status options and the label preselected when `statut` is absent from the URL.
  statusOptions: string[];
  defaultStatut: string;
  // Current text query, used as the input default value.
  currentQuery: string;
  // Raw `statut`/`sortBy`/`sortOrder` params: `statut` drives the select's selected
  // value, the sort params are mirrored as hidden fields so a search keeps the
  // current ordering.
  statutParam?: string;
  sortByParam?: string;
  sortOrderParam?: string;
};

// Single native GET form (no client JS) wrapping the status filter and the text
// search. Both fields are submitted together via the « Rechercher » button; the
// browser stores the `dahliaq` value and offers previous searches on focus/typing.
// The trade-off is a full navigation on each search instead of a SPA router.push.
export function CaseFilesSearch({
  statusOptions,
  defaultStatut,
  currentQuery,
  statutParam,
  sortByParam,
  sortOrderParam,
}: Props) {
  return (
    <form
      role="search"
      method="get"
      action="/case_files"
      // No `page` field → submitting resets to page 1.
    >
      <div className={clsx("flex", "flex-row", "gap-2", "items-end")}>
        <CaseFilesSearchByStatus
          // Force a remount when the status param changes so the uncontrolled
          // <select> picks up its new defaultValue on client navigation (e.g.
          // the reset link); without this, React keeps the stale DOM value.
          key={`statut-${statutParam ?? "__default__"}`}
          options={statusOptions}
          defaultStatut={defaultStatut}
          statutParam={statutParam}
        />
        <CaseFilesSearchBar className="fr-mb-3w flex-1" currentQuery={currentQuery} />
      </div>

      {/* Mirror the current sort context. Emit the sort fields only when an
          explicit sort is set, to keep page.tsx's default detection. */}
      {sortByParam && <HiddenField name="sortBy" value={sortByParam} />}
      {sortByParam && sortOrderParam && (
        <HiddenField name="sortOrder" value={sortOrderParam} />
      )}

      <div className={clsx("flex", "flex-row", "gap-4", "items-center")}>
        <Button type="submit">Rechercher</Button>
        <Link
          href="/case_files"
          className={fr.cx("fr-link", "fr-icon-refresh-line", "fr-link--icon-left")}
        >
          Ré-initialiser la recherche
        </Link>
      </div>
    </form>
  );
}
